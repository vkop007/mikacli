import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_RUN_TIMEOUT_MS,
  MIMIKA_CONNECT_GRANT_HEADER,
  MIMIKA_CONNECT_PLATFORM_HEADER,
  TOOLS,
  buildChildEnvironment,
  callTool,
  handleRpc,
  startMcpHttpServer,
} from "../commands/serve.js";
import { PlatformStateStore } from "../core/platform-state.js";
import { MCP_PROTOCOL_VERSION, MIKACLI_VERSION } from "../integration-metadata.js";
import {
  MIMIKA_BROWSER_CONNECT_GRANT_ENV,
  MIMIKA_BROWSER_CONNECT_PLATFORM_ENV,
} from "../utils/mimika-browser-client.js";

import type { Server } from "node:http";

const temporaryDirectories: string[] = [];
const servers: Server[] = [];
const CONNECT_GRANT = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("MCP runtime", () => {
  test("returns package, protocol, and catalog metadata during initialize", async () => {
    const response = await handleRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: MCP_PROTOCOL_VERSION },
    }) as { result: Record<string, unknown> };

    expect(response.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(response.result.serverInfo).toEqual({ name: "mikacli", version: MIKACLI_VERSION });
    expect(response.result._meta).toBeDefined();
  });

  test("rejects malformed JSON-RPC requests", async () => {
    const response = await handleRpc({ id: 1, method: "ping" }) as {
      error: { code: number };
    };
    expect(response.error.code).toBe(-32600);
  });

  test("management state is persistent and prevents execution while disabled", async () => {
    const stateStore = await createStore();
    const managed = await callTool("mika_manage_platform", {
      action: "disable",
      platform: "dns",
    }, { stateStore });
    expect(managed.isError).not.toBe(true);
    expect(managed.structuredContent?.state).toMatchObject({ status: "disabled" });

    let invoked = false;
    const run = await callTool("mika_run", {
      platform: "dns",
      arguments: { _: ["example.com"] },
    }, {
      stateStore,
      runCli: async () => {
        invoked = true;
        return { code: 0, stdout: "{}", stderr: "" };
      },
    });
    expect(run.isError).toBe(true);
    expect(run.content[0]?.text).toContain("disabled");
    expect(invoked).toBe(false);
  });

  test("runs a direct provider without capability using explicit cwd and long timeout", async () => {
    const stateStore = await createStore();
    const calls: Array<{ argv: string[]; cwd: string; timeoutMs: number }> = [];
    const result = await callTool("mika_run", {
      platform: "dns",
      arguments: { _: ["example.com"], type: "MX" },
    }, {
      cwd: "/tmp",
      stateStore,
      runCli: async (argv, options) => {
        calls.push({ argv, ...options });
        return { code: 0, stdout: JSON.stringify({ ok: true }), stderr: "" };
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({ ok: true });
    expect(calls).toEqual([{
      argv: ["tools", "dns", "example.com", "--type", "MX", "--json"],
      cwd: "/tmp",
      timeoutMs: DEFAULT_RUN_TIMEOUT_MS,
    }]);
  });

  test("requires a known capability for subcommand providers", async () => {
    const stateStore = await createStore();
    const missing = await callTool("mika_run", { platform: "linear" }, { stateStore });
    expect(missing.isError).toBe(true);
    expect(missing.content[0]?.text).toContain("needs a `capability`");

    const unknown = await callTool("mika_run", {
      platform: "linear",
      capability: "not-real",
    }, { stateStore });
    expect(unknown.isError).toBe(true);
    expect(unknown.content[0]?.text).toContain("has no capability");
  });

  test("auth status refresh invokes active validation before returning JSON", async () => {
    const calls: Array<{ argv: string[]; cwd: string; timeoutMs: number }> = [];
    const result = await callTool("mika_auth_status", {
      platform: "github",
      refresh: true,
    }, {
      cwd: "/tmp",
      stateStore: await createStore(),
      runCli: async (argv, options) => {
        calls.push({ argv, ...options });
        return {
          code: 0,
          stdout: JSON.stringify({ ok: true, entries: [{ platform: "github" }] }),
          stderr: "",
        };
      },
    });

    expect(result.isError).not.toBe(true);
    expect(calls).toEqual([{
      argv: ["status", "--refresh", "--json"],
      cwd: "/tmp",
      timeoutMs: 60_000,
    }]);
  });

  test("child environments remove ambient Connect grants and add only explicit request overrides", () => {
    const beforeGrant = process.env[MIMIKA_BROWSER_CONNECT_GRANT_ENV];
    const beforePlatform = process.env[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV];
    process.env[MIMIKA_BROWSER_CONNECT_GRANT_ENV] = "ambient-secret";
    process.env[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV] = "ambient-platform";
    try {
      const normal = buildChildEnvironment();
      expect(normal[MIMIKA_BROWSER_CONNECT_GRANT_ENV]).toBeUndefined();
      expect(normal[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV]).toBeUndefined();

      const authorized = buildChildEnvironment({
        [MIMIKA_BROWSER_CONNECT_GRANT_ENV]: CONNECT_GRANT,
        [MIMIKA_BROWSER_CONNECT_PLATFORM_ENV]: "github",
      });
      expect(authorized[MIMIKA_BROWSER_CONNECT_GRANT_ENV]).toBe(CONNECT_GRANT);
      expect(authorized[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV]).toBe("github");
      expect(process.env[MIMIKA_BROWSER_CONNECT_GRANT_ENV]).toBe("ambient-secret");
      expect(process.env[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV]).toBe("ambient-platform");
    } finally {
      if (beforeGrant === undefined) delete process.env[MIMIKA_BROWSER_CONNECT_GRANT_ENV];
      else process.env[MIMIKA_BROWSER_CONNECT_GRANT_ENV] = beforeGrant;
      if (beforePlatform === undefined) delete process.env[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV];
      else process.env[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV] = beforePlatform;
    }
  });
});

describe("MCP HTTP server", () => {
  test("exposes unauthenticated health metadata and protects MCP with bearer auth", async () => {
    const server = await startMcpHttpServer("127.0.0.1", 0, {
      token: "secret",
      stateStore: await createStore(),
    });
    servers.push(server);
    const origin = serverOrigin(server);

    const health = await fetch(`${origin}/health`);
    expect(health.status).toBe(200);
    const healthBody = await health.json() as Record<string, unknown>;
    expect(healthBody.ok).toBe(true);
    expect((healthBody.distribution as Record<string, unknown>).version).toBe(MIKACLI_VERSION);

    const unauthorized = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(authorized.status).toBe(200);
    const payload = await authorized.json() as {
      result: { tools: unknown[] };
    };
    expect(payload.result.tools).toHaveLength(TOOLS.length);
  });

  test("rejects non-JSON requests and unknown routes", async () => {
    const server = await startMcpHttpServer("127.0.0.1", 0, {
      stateStore: await createStore(),
    });
    servers.push(server);
    const origin = serverOrigin(server);

    expect((await fetch(`${origin}/missing`)).status).toBe(404);
    expect((await fetch(`${origin}/mcp`, { method: "POST", body: "{}" })).status).toBe(415);
  });

  test("binds a browser grant to one non-batch mika_run child environment", async () => {
    const calls: Array<{
      argv: string[];
      environment?: Record<string, string>;
    }> = [];
    const server = await startMcpHttpServer("127.0.0.1", 0, {
      stateStore: await createStore(),
      runCli: async (argv, options) => {
        calls.push({ argv, environment: options.environment });
        return { code: 0, stdout: "{}", stderr: "" };
      },
    });
    servers.push(server);
    const origin = serverOrigin(server);
    const loginPayload = {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "mika_run",
        arguments: { platform: "github", capability: "login", arguments: {} },
      },
    };

    const connected = await postMcp(origin, loginPayload, {
      [MIMIKA_CONNECT_GRANT_HEADER]: CONNECT_GRANT,
      [MIMIKA_CONNECT_PLATFORM_HEADER]: "github",
    });
    expect(connected.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.environment).toEqual({
      [MIMIKA_BROWSER_CONNECT_GRANT_ENV]: CONNECT_GRANT,
      [MIMIKA_BROWSER_CONNECT_PLATFORM_ENV]: "github",
    });

    const operation = await postMcp(origin, {
      ...loginPayload,
      id: 8,
      params: { name: "mika_run", arguments: { platform: "github", capability: "issues", arguments: {} } },
    }, {
      [MIMIKA_CONNECT_GRANT_HEADER]: CONNECT_GRANT,
      [MIMIKA_CONNECT_PLATFORM_HEADER]: "github",
    });
    expect(operation.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.environment).toEqual({
      [MIMIKA_BROWSER_CONNECT_GRANT_ENV]: CONNECT_GRANT,
      [MIMIKA_BROWSER_CONNECT_PLATFORM_ENV]: "github",
    });

    const status = await postMcp(origin, {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "mika_auth_status", arguments: { platform: "github" } },
    });
    expect(status.status).toBe(200);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.environment).toBeUndefined();

    const invalidRequests: Array<{
      payload: unknown;
      headers: Record<string, string>;
    }> = [
      { payload: loginPayload, headers: { [MIMIKA_CONNECT_GRANT_HEADER]: CONNECT_GRANT } },
      {
        payload: loginPayload,
        headers: {
          [MIMIKA_CONNECT_GRANT_HEADER]: CONNECT_GRANT,
          [MIMIKA_CONNECT_PLATFORM_HEADER]: "gitlab",
        },
      },
      {
        payload: { jsonrpc: "2.0", id: 9, method: "tools/list" },
        headers: {
          [MIMIKA_CONNECT_GRANT_HEADER]: CONNECT_GRANT,
          [MIMIKA_CONNECT_PLATFORM_HEADER]: "github",
        },
      },
      {
        payload: [loginPayload],
        headers: {
          [MIMIKA_CONNECT_GRANT_HEADER]: CONNECT_GRANT,
          [MIMIKA_CONNECT_PLATFORM_HEADER]: "github",
        },
      },
    ];
    for (const request of invalidRequests) {
      const response = await postMcp(origin, request.payload, request.headers);
      expect(response.status).toBe(400);
      const body = await response.json() as { error: { code: number; message: string } };
      expect(body.error.code).toBe(-32602);
      expect(body.error.message).not.toContain(CONNECT_GRANT);
    }
    expect(calls).toHaveLength(3);
  });
});

function postMcp(
  origin: string,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${origin}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(payload),
  });
}

async function createStore(): Promise<PlatformStateStore> {
  const directory = await mkdtemp(join(tmpdir(), "mikacli-serve-runtime-"));
  temporaryDirectories.push(directory);
  return new PlatformStateStore({ path: join(directory, "platforms.json") });
}

function serverOrigin(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address.");
  return `http://127.0.0.1:${address.port}`;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { Command } from "commander";

import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { getPlatformDefinitions, getPlatformDefinition } from "../platforms/index.js";

import type { PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { Command as CommanderCommand } from "commander";

/**
 * Expose mikacli over the Model Context Protocol.
 *
 * Four tools, not one per capability. There are ~120 platforms with roughly
 * eight capabilities each; a client that carries all of them spends its whole
 * tool budget before the user has typed anything, and picks worse from a list
 * that long. So the catalog is discovered rather than carried: list, describe
 * the one platform that matters, then run.
 *
 * Discovery is answered in-process from the registry. Anything that touches a
 * session or the network shells out to this same CLI with `--json` instead.
 * That costs a process start per call, and buys isolation: capabilities write
 * to stdout, and a server that captured stdout in-process would interleave two
 * concurrent calls into one unparseable stream.
 */

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";
const PROTOCOL_VERSION = "2025-06-18";
const RUN_TIMEOUT_MS = 120_000;
const MAX_BODY_BYTES = 1024 * 1024;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// ---------------------------------------------------------------------------
// Catalog introspection
// ---------------------------------------------------------------------------

/**
 * Capabilities register themselves onto a Commander command rather than
 * declaring a schema, so the schema has to be read back off the built command.
 * This is the only place that knows that, deliberately: everything downstream
 * sees plain JSON Schema.
 */
/** Every provider is reached through its category: `mikacli tools dns`, never `mikacli dns`. */
export function commandPath(definition: PlatformDefinition): string[] {
  return [definition.category, definition.id];
}

/** The metadata subcommand every platform gets for free is not a capability. */
export function isMetadataSubcommand(name: string): boolean {
  return name === "capabilities" || name === "caps";
}

function argumentSchema(command: CommanderCommand): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const positional: string[] = [];

  for (const argument of command.registeredArguments ?? []) {
    positional.push(argument.name());
    if (argument.required) required.push("_");
  }
  if (positional.length > 0) {
    properties._ = {
      type: "array",
      items: { type: "string" },
      description: `Ordered positional arguments: ${positional.join(", ")}`,
    };
  }

  for (const option of command.options) {
    if (option.hidden) continue;
    const name = option.attributeName();
    if (name === "help") continue;
    // A flag with no value is a boolean; everything else takes a string and
    // Commander coerces it on the way back in.
    properties[name] = {
      type: option.isBoolean() ? "boolean" : "string",
      description: option.description || `Option ${option.flags}`,
    };
    if (option.mandatory) required.push(name);
  }

  return { type: "object", properties, required };
}

export function describePlatform(definition: PlatformDefinition): Record<string, unknown> {
  let built: CommanderCommand;
  try {
    built = buildPlatformCommand(definition);
  } catch (error) {
    return {
      platform: definition.id,
      error: `Could not build the command tree: ${String(error)}`,
      capabilities: [],
    };
  }

  const subcommands = built.commands.filter((sub) => !isMetadataSubcommand(sub.name()));

  // Two shapes exist and they are called differently, so the description says
  // which one this is rather than leaving the caller to infer it from an empty
  // capability list. `linear` dispatches to subcommands; `dns` is itself the
  // action and takes its arguments directly.
  const invocation = subcommands.length > 0 ? "subcommand" : "direct";

  const base = {
    platform: definition.id,
    displayName: definition.displayName,
    category: definition.category,
    description: definition.description,
    authStrategies: definition.authStrategies,
    invocation,
    examples: definition.examples ?? [],
  };

  if (invocation === "direct") {
    return {
      ...base,
      callWith: "mika_run { platform, arguments } — omit `capability`",
      arguments: argumentSchema(built),
      capabilities: [],
    };
  }

  return {
    ...base,
    callWith: "mika_run { platform, capability, arguments }",
    capabilities: subcommands.map((sub) => ({
      name: sub.name(),
      description: sub.description() || "",
      arguments: argumentSchema(sub),
    })),
  };
}

export function listPlatforms(category?: string, auth?: string): Record<string, unknown> {
  const all = getPlatformDefinitions();
  const filtered = all.filter((definition) => {
    if (category && definition.category !== category) return false;
    if (auth && !definition.authStrategies.includes(auth as never)) return false;
    return true;
  });

  // One compact line each. The whole point of this tool is that the caller can
  // afford to read all of it.
  return {
    total: filtered.length,
    platforms: filtered.map((definition) => ({
      platform: definition.id,
      displayName: definition.displayName,
      category: definition.category,
      auth: definition.authStrategies,
      needsCredential: !definition.authStrategies.includes("none" as never),
      description: definition.description,
    })),
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/** Turn a JSON argument object back into the flags Commander expects. */
export function toCliArguments(args: Record<string, unknown> | undefined): string[] {
  if (!args) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    // Positional arguments are passed under `_`, in order.
    if (key === "_") {
      for (const positional of Array.isArray(value) ? value : [value]) {
        out.push(String(positional));
      }
      continue;
    }
    const flag = `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    if (typeof value === "boolean") {
      if (value) out.push(flag);
      continue;
    }
    out.push(flag, String(value));
  }
  return out;
}

function cliEntryPoint(): { command: string; leading: string[] } {
  // Re-invoke whatever is running this server, so a dev run through Bun and an
  // installed dist build both spawn themselves rather than a guessed binary.
  const entry = process.argv[1];
  return { command: process.execPath, leading: entry ? [entry] : [] };
}

function runCli(argv: string[], timeoutMs = RUN_TIMEOUT_MS): Promise<{ code: number; stdout: string; stderr: string }> {
  const { command, leading } = cliEntryPoint();
  return new Promise((resolve) => {
    const child = spawn(command, [...leading, ...argv], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolve({ code: 124, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms.` });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: String(error) });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], isError };
}

function jsonResult(value: unknown): ToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "mika_list_platforms":
      return jsonResult(
        listPlatforms(
          typeof args.category === "string" ? args.category : undefined,
          typeof args.auth === "string" ? args.auth : undefined,
        ),
      );

    case "mika_describe": {
      const platform = typeof args.platform === "string" ? args.platform : "";
      const definition = getPlatformDefinition(platform as never);
      if (!definition) {
        return textResult(
          `No platform named "${platform}". Call mika_list_platforms to see what exists.`,
          true,
        );
      }
      return jsonResult(describePlatform(definition));
    }

    case "mika_auth_status": {
      const argv = ["status", "--json"];
      const result = await runCli(argv, 60_000);
      if (result.code !== 0 && !result.stdout.trim()) {
        return textResult(result.stderr.trim() || "mikacli status failed.", true);
      }
      const platform = typeof args.platform === "string" ? args.platform : undefined;
      if (!platform) return textResult(result.stdout.trim());
      // Filtering here rather than shelling out per platform keeps one process
      // start regardless of how many the caller asks about.
      try {
        const parsed = JSON.parse(result.stdout) as { entries?: Array<{ platform?: string }> };
        const entries = (parsed.entries ?? []).filter((entry) => entry.platform === platform);
        return jsonResult({ ...parsed, entries });
      } catch {
        return textResult(result.stdout.trim());
      }
    }

    case "mika_run": {
      const platform = typeof args.platform === "string" ? args.platform : "";
      const capability = typeof args.capability === "string" ? args.capability : "";
      if (!platform) {
        return textResult("mika_run needs a `platform`.", true);
      }
      const definition = getPlatformDefinition(platform as never);
      if (!definition) {
        return textResult(`No platform named "${platform}".`, true);
      }

      const callArgs = (args.arguments ?? {}) as Record<string, unknown>;
      // Category prefix is mandatory: top-level provider commands are refused.
      // A direct-invocation platform takes no capability segment at all.
      const argv = [
        ...commandPath(definition),
        ...(capability ? [capability] : []),
        ...toCliArguments(callArgs),
        "--json",
      ];
      const result = await runCli(argv);

      if (result.code !== 0) {
        // stdout still carries the structured error when --json is honoured, so
        // prefer it and fall back to stderr rather than losing the detail.
        const detail = result.stdout.trim() || result.stderr.trim() || `exit ${result.code}`;
        return textResult(detail, true);
      }
      return textResult(result.stdout.trim() || "(no output)");
    }

    default:
      return textResult(`Unknown tool "${name}".`, true);
  }
}

// ---------------------------------------------------------------------------
// Tool declarations
// ---------------------------------------------------------------------------

export const TOOLS = [
  {
    name: "mika_list_platforms",
    description:
      "List the platforms mikacli can reach. Start here: it is the only tool that needs no arguments, and it names every platform the other tools accept. Platforms whose auth is `none` work immediately with no sign-in.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional filter, e.g. developer, devops, google, social, tools.",
        },
        auth: {
          type: "string",
          description: "Optional filter: none, cookies, apiKey, oauth2, session, botToken.",
        },
      },
      required: [],
    },
  },
  {
    name: "mika_describe",
    description:
      "Show one platform's capabilities and their argument schemas. Read this before calling mika_run rather than guessing argument names — capabilities change between mikacli releases and this returns the live schema.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Platform id from mika_list_platforms." },
      },
      required: ["platform"],
    },
  },
  {
    name: "mika_auth_status",
    description:
      "Report saved session state: which platforms are connected, expired, or never configured, and whether the answer is live or last-known. Use it before a capability that needs credentials, so an expired session is reported as expired rather than failing mid-task.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Optional: report only this platform." },
      },
      required: [],
    },
  },
  {
    name: "mika_run",
    description:
      "Run one capability on one platform. Call mika_describe first: it reports whether the platform dispatches to a named capability or is invoked directly, and gives the argument schema. Positional arguments go in `arguments._` as an ordered array; everything else is named.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Platform id." },
        capability: {
          type: "string",
          description:
            "Capability name from mika_describe. Omit it when mika_describe reports invocation: direct.",
        },
        arguments: {
          type: "object",
          description: "Named arguments, plus `_` for ordered positional arguments.",
        },
      },
      required: ["platform", "capability"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// JSON-RPC / HTTP
// ---------------------------------------------------------------------------

async function handleRpc(request: JsonRpcRequest): Promise<unknown | undefined> {
  const { method, id, params } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "mikacli", version: "1.0.1" },
        },
      };

    // Notifications carry no id and must not be answered.
    case "notifications/initialized":
      return undefined;

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args);
        return { jsonrpc: "2.0", id, result };
      } catch (error) {
        return {
          jsonrpc: "2.0",
          id,
          result: textResult(`mikacli failed to run ${name}: ${String(error)}`, true),
        };
      }
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      body += String(chunk);
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function startServer(host: string, port: number, token: string | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json", Allow: "POST" });
        res.end(JSON.stringify({ error: "Only POST is supported." }));
        return;
      }

      // Optional shared secret. Loopback already keeps this off the network;
      // the token guards against another local process on a shared machine.
      if (token) {
        const provided = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
        if (provided !== token) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_token" }));
          return;
        }
      }

      let payload: JsonRpcRequest;
      try {
        payload = JSON.parse(await readBody(req)) as JsonRpcRequest;
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: `Parse error: ${String(error)}` },
          }),
        );
        return;
      }

      const response = await handleRpc(payload);
      if (response === undefined) {
        // A notification: acknowledged with no body.
        res.writeHead(202);
        res.end();
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    });

    server.on("error", reject);
    server.listen(port, host, () => {
      const address = `http://${host}:${port}`;
      process.stderr.write(`mikacli MCP server listening on ${address}\n`);
      process.stderr.write(`  tools: ${TOOLS.map((tool) => tool.name).join(", ")}\n`);
      process.stderr.write(`  platforms: ${getPlatformDefinitions().length}\n`);
      if (token) process.stderr.write("  auth: bearer token required\n");
      resolve();
    });
  });
}

export function createServeCommand(): Command {
  return new Command("serve")
    .description("Run mikacli as a local MCP server so an agent can use every platform")
    .option("--mcp", "Serve the Model Context Protocol (currently the only mode)", true)
    .option("--port <port>", `Port to bind (default ${DEFAULT_PORT})`, String(DEFAULT_PORT))
    .option("--host <host>", `Interface to bind (default ${DEFAULT_HOST})`, DEFAULT_HOST)
    .option("--token <token>", "Require this bearer token on every request")
    .addHelpText(
      "after",
      `
Examples:
  mikacli serve --mcp
  mikacli serve --mcp --port 8790
  mikacli serve --mcp --token "$(openssl rand -hex 16)"

Connect from Mimika:
  the endpoint is http://127.0.0.1:${DEFAULT_PORT}, transport streamable-http
`,
    )
    .action(async (options: { port?: string; host?: string; token?: string }) => {
      const port = Number.parseInt(options.port ?? String(DEFAULT_PORT), 10);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid port: ${options.port}`);
      }
      const host = options.host ?? DEFAULT_HOST;
      if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1" && !options.token) {
        // Binding beyond loopback without a token would expose every saved
        // session on the machine to anything that can reach the port.
        throw new Error(
          `Refusing to bind ${host} without --token. Use 127.0.0.1, or pass a token.`,
        );
      }
      await startServer(host, port, options.token);
      // Hold the process open; the server owns the lifetime from here.
      await new Promise(() => {});
    });
}

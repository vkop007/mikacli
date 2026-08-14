import { afterEach, describe, expect, test } from "bun:test";

import { MikaCliError } from "../errors.js";
import {
  captureBrowserLogin,
  captureSharedBrowserNetwork,
  runBrowserActionPlan,
} from "../utils/browser-cookie-login.js";
import {
  MIMIKA_BROWSER_GRANT_HEADER,
  MIMIKA_BROWSER_PLATFORM_HEADER,
  MIMIKA_BROWSER_PROTOCOL,
  MIMIKA_BROWSER_PROTOCOL_VERSION,
  MimikaBrowserGatewayClient,
} from "../utils/mimika-browser-client.js";
import type {
  MimikaBrowserCapabilities,
  MimikaBrowserGateway,
  MimikaBrowserSession,
} from "../utils/mimika-browser-client.js";
import { buildMimikaPageScript } from "../utils/mimika-browser-page.js";

const previousManaged = process.env.MIMIKA_MIKACLI_MANAGED;
const CONNECT_GRANT = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

afterEach(() => {
  if (previousManaged === undefined) delete process.env.MIMIKA_MIKACLI_MANAGED;
  else process.env.MIMIKA_MIKACLI_MANAGED = previousManaged;
});

describe("Mimika browser gateway client", () => {
  test("authenticates every request and exports exactly the requested origin", async () => {
    const calls: Array<{ url: URL; init?: RequestInit; body?: unknown }> = [];
    const client = new MimikaBrowserGatewayClient({
      gatewayUrl: "http://127.0.0.1:9321",
      token: "gateway-secret",
      connectGrant: CONNECT_GRANT,
      connectPlatform: "github",
      fetchFn: async (input, init) => {
        const url = new URL(String(input));
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : undefined;
        calls.push({ url, init, body });

        if (url.pathname === "/daemon/browser/capabilities") {
          return jsonResponse(capabilities());
        }
        if (url.pathname === "/daemon/mikacli/browser/action") {
          return jsonResponse({
            exit_code: 0,
            stdout: body && typeof body === "object" && "tabs_action" in body && body.tabs_action === "new"
              ? "Opened broker tab ext:session_42: https://github.com/login"
              : "Closed broker tab ext:session_42.",
            stderr: "",
            duration_ms: 1,
          });
        }
        return jsonResponse(sessionResponse({
          origin: "https://github.com",
          current_url: "https://github.com/settings/profile",
          cookies: [{ name: "user_session", value: "secret", domain: ".github.com", path: "/" }],
        }));
      },
    });

    await client.getCapabilities();
    const tabHandle = await client.openTab("https://github.com/login");
    const session = await client.exportOriginSession("https://github.com/settings/profile", tabHandle);
    await client.closeTab(tabHandle);

    expect(tabHandle).toBe("ext:session_42");
    expect(session.origin).toBe("https://github.com");
    expect(calls.map((call) => call.url.pathname)).toEqual([
      "/daemon/browser/capabilities",
      "/daemon/mikacli/browser/action",
      "/daemon/browser/session/export",
      "/daemon/mikacli/browser/action",
    ]);
    expect(calls.every((call) => new Headers(call.init?.headers).get("Authorization") === "Bearer gateway-secret")).toBe(true);
    expect(new Headers(calls[0]!.init?.headers).get(MIMIKA_BROWSER_GRANT_HEADER)).toBeNull();
    expect(new Headers(calls[0]!.init?.headers).get(MIMIKA_BROWSER_PLATFORM_HEADER)).toBeNull();
    for (const call of calls.slice(1)) {
      const headers = new Headers(call.init?.headers);
      expect(headers.get(MIMIKA_BROWSER_GRANT_HEADER)).toBe(CONNECT_GRANT);
      expect(headers.get(MIMIKA_BROWSER_PLATFORM_HEADER)).toBe("github");
      expect(JSON.stringify(call.body ?? {})).not.toContain(CONNECT_GRANT);
    }
    expect(calls[2]!.body).toEqual({
      origin: "https://github.com",
      tab_handle: "ext:session_42",
      include_local_storage: true,
      include_session_storage: true,
    });
    expect(calls[1]!.body).toEqual({
      action: "browser_tabs",
      tabs_action: "new",
      broker_protocol: 1,
      url: "https://github.com/login",
    });
    expect(calls[3]!.body).toEqual({
      action: "browser_tabs",
      tabs_action: "close",
      tab_handle: "ext:session_42",
    });
  });

  test("accepts each versioned opaque backend handle and rejects legacy numeric output", async () => {
    for (const handle of ["ext:42", "pw:7", "cdp:ABC_def-9"] as const) {
      const client = new MimikaBrowserGatewayClient({
        gatewayUrl: "http://127.0.0.1:9321",
        token: "gateway-secret",
        connectGrant: CONNECT_GRANT,
        connectPlatform: "github",
        fetchFn: async () => jsonResponse({
          exit_code: 0,
          stdout: `Opened broker tab ${handle}: https://github.com/`,
          stderr: "",
          duration_ms: 1,
        }),
      });
      expect(await client.openTab("https://github.com/")).toBe(handle);
    }

    const legacy = new MimikaBrowserGatewayClient({
      gatewayUrl: "http://127.0.0.1:9321",
      token: "gateway-secret",
      connectGrant: CONNECT_GRANT,
      connectPlatform: "github",
      fetchFn: async () => jsonResponse({
        exit_code: 0,
        stdout: "Opened tab 7: https://github.com/",
        stderr: "",
        duration_ms: 1,
      }),
    });
    await expect(legacy.openTab("https://github.com/")).rejects.toMatchObject({
      code: "MIMIKA_BROWSER_INVALID_RESPONSE",
    });
  });

  test("rejects the entire export when Mimika returns a foreign-domain cookie", async () => {
    const client = new MimikaBrowserGatewayClient({
      gatewayUrl: "http://127.0.0.1:9321",
      token: "gateway-secret",
      connectGrant: CONNECT_GRANT,
      connectPlatform: "github",
      fetchFn: async () => jsonResponse(sessionResponse({
        origin: "https://github.com",
        current_url: "https://github.com/",
        cookies: [
          { name: "user_session", value: "ok", domain: ".github.com", path: "/" },
          { name: "foreign", value: "must-not-leak", domain: ".example.com", path: "/" },
        ],
      })),
    });

    try {
      await client.exportOriginSession("https://github.com", "ext:7");
      throw new Error("Expected the unscoped export to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(MikaCliError);
      expect((error as MikaCliError).code).toBe("MIMIKA_BROWSER_SCOPE_VIOLATION");
      expect((error as MikaCliError).details?.exportRejected).toBe(true);
    }
  });

  test("refuses a broker that advertises a local-browser fallback", async () => {
    const unsafe = capabilities();
    (unsafe.capabilities as { local_browser_fallback: boolean }).local_browser_fallback = true;
    const client = new MimikaBrowserGatewayClient({
      gatewayUrl: "http://127.0.0.1:9321",
      token: "gateway-secret",
      fetchFn: async () => jsonResponse(unsafe),
    });

    await expect(client.getCapabilities()).rejects.toMatchObject({
      code: "MIMIKA_BROWSER_INCOMPATIBLE",
    });
  });

  test("requires request-scoped consent before open, export, or close but not capabilities", async () => {
    let requests = 0;
    const client = new MimikaBrowserGatewayClient({
      gatewayUrl: "http://127.0.0.1:9321",
      token: "gateway-secret",
      fetchFn: async () => {
        requests += 1;
        return jsonResponse(capabilities());
      },
    });

    await client.getCapabilities();
    expect(requests).toBe(1);
    for (const operation of [
      () => client.openTab("https://github.com/"),
      () => client.exportOriginSession("https://github.com", "ext:session_7"),
      () => client.closeTab("ext:session_7"),
    ]) {
      await expect(operation()).rejects.toMatchObject({
        code: "MIMIKA_BROWSER_CONSENT_REQUIRED",
      });
    }
    expect(requests).toBe(1);
  });
});

describe("managed MikaCLI browser behavior", () => {
  test("serialized managed Page runtime is valid async JavaScript", () => {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
    const script = buildMimikaPageScript({ op: "content" }, "https://github.com");
    expect(() => new AsyncFunction(script)).not.toThrow();
    expect(Buffer.byteLength(JSON.stringify({
      action: "browser_script",
      origin: "https://github.com",
      tab_handle: "pw:test",
      script,
    }))).toBeLessThan(64 * 1024);
  });

  test("central browser login uses Mimika and captures only the platform origin", async () => {
    process.env.MIMIKA_MIKACLI_MANAGED = "1";
    const calls: Array<{ method: string; value?: string | number }> = [];
    const gateway: MimikaBrowserGateway = {
      async getCapabilities() {
        calls.push({ method: "capabilities" });
        return capabilities();
      },
      async openTab(url) {
        calls.push({ method: "open", value: url });
        return "pw:73";
      },
      async closeTab(tabHandle) {
        calls.push({ method: "close", value: tabHandle });
      },
      async exportOriginSession(origin, tabHandle) {
        calls.push({ method: "export", value: `${origin}:${tabHandle}` });
        return {
          protocol: MIMIKA_BROWSER_PROTOCOL,
          protocol_version: MIMIKA_BROWSER_PROTOCOL_VERSION,
          origin,
          current_url: "https://github.com/",
          cookies: [
            { name: "user_session", value: "authenticated", domain: ".github.com", path: "/" },
            { name: "logged_in", value: "true", domain: ".github.com", path: "/" },
          ],
          local_storage: {},
          session_storage: {},
        };
      },
    };

    const capture = await captureBrowserLogin("github", {
      browserUrl: "https://github.com/login?return_to=%2Fsettings",
      timeoutSeconds: 1,
      pollIntervalMs: 10,
      gatewayClient: gateway,
    });

    expect(capture.cookies).toHaveLength(2);
    expect(calls).toEqual([
      { method: "capabilities" },
      { method: "open", value: "https://github.com/login?return_to=%2Fsettings" },
      { method: "export", value: "https://github.com:pw:73" },
      { method: "close", value: "pw:73" },
    ]);
  });

  test("provider Page workflows execute through Mimika without a local launch path", async () => {
    process.env.MIMIKA_MIKACLI_MANAGED = "1";
    let callbackCalls = 0;
    const actions: string[] = [];
    const client = new MimikaBrowserGatewayClient({
      gatewayUrl: "http://127.0.0.1:9321",
      token: "gateway-secret",
      connectGrant: CONNECT_GRANT,
      connectPlatform: "github",
      fetchFn: async (input, init) => {
        const url = new URL(String(input));
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
        if (url.pathname === "/daemon/browser/capabilities") return jsonResponse(capabilities());
        actions.push(String(body.action));
        if (body.tabs_action === "new") {
          return jsonResponse({ exit_code: 0, stdout: "Opened broker tab pw:page_1: https://github.com/", stderr: "", duration_ms: 1 });
        }
        if (body.action === "browser_script") {
          return jsonResponse({
            exit_code: 0,
            stdout: JSON.stringify({ __mimikaMikaPage: 1, currentUrl: "https://github.com/", value: "<html>remote</html>" }),
            stderr: "",
            duration_ms: 1,
          });
        }
        return jsonResponse({ exit_code: 0, stdout: "Closed broker tab pw:page_1.", stderr: "", duration_ms: 1 });
      },
    });

    const result = await runBrowserActionPlan({
      targetUrl: "https://github.com/",
      steps: [
        { source: "headless", shouldContinueOnError: () => true },
        { source: "profile", shouldContinueOnError: () => true },
        { source: "shared", shouldContinueOnError: () => true },
      ],
      managedGatewayClient: client,
      action: async (page, source) => {
        callbackCalls += 1;
        expect(source).toBe("shared");
        return page.content();
      },
    });
    expect(result).toBe("<html>remote</html>");
    expect(callbackCalls).toBe(1);
    expect(actions).toEqual(["browser_tabs", "browser_script", "browser_tabs"]);
  });

  test("managed network capture exposes only sanitized same-origin metadata", async () => {
    process.env.MIMIKA_MIKACLI_MANAGED = "1";
    let responsePolls = 0;
    const client = new MimikaBrowserGatewayClient({
      gatewayUrl: "http://127.0.0.1:9321",
      token: "gateway-secret",
      connectGrant: CONNECT_GRANT,
      connectPlatform: "github",
      fetchFn: async (input, init) => {
        const url = new URL(String(input));
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
        if (url.pathname === "/daemon/browser/capabilities") return jsonResponse(capabilities());
        if (body.tabs_action === "new") {
          return jsonResponse({ exit_code: 0, stdout: "Opened broker tab pw:capture_1: https://github.com/", stderr: "", duration_ms: 1 });
        }
        if (body.tabs_action === "close") {
          return jsonResponse({ exit_code: 0, stdout: "Closed broker tab pw:capture_1.", stderr: "", duration_ms: 1 });
        }
        const script = String(body.script ?? "");
        let value: unknown = null;
        if (script.includes('"op":"installResponseCapture"')) value = true;
        if (script.includes('"op":"responseSequence"')) value = 0;
        if (script.includes('"op":"responses"')) {
          value = responsePolls++ === 0 ? [
            {
              sequence: 1,
              url: "https://github.com/api/user?token=must-not-leak#private",
              method: "POST",
              status: 201,
              statusText: "Created",
              headers: { authorization: "Bearer must-not-leak" },
              body: "must-not-leak",
              postData: "password=must-not-leak",
            },
            {
              sequence: 2,
              url: "https://evil.example/collect?secret=must-not-leak",
              method: "GET",
              status: 200,
              statusText: "OK",
              headers: {},
              body: "cross-origin",
            },
          ] : [];
        }
        if (script.includes('"op":"evaluate"')) value = "https://github.com/";
        return jsonResponse({
          exit_code: 0,
          stdout: JSON.stringify({ __mimikaMikaPage: 1, currentUrl: "https://github.com/", value }),
          stderr: "",
          duration_ms: 1,
        });
      },
    });

    const capture = await captureSharedBrowserNetwork({
      targetUrl: "https://github.com/",
      timeoutSeconds: 1,
      limit: 10,
      gatewayClient: client,
    });

    expect(capture.requests).toEqual([{
      id: 1,
      method: "POST",
      url: "https://github.com/api/user",
      resourceType: "other",
      requestHeaders: {},
      responseHeaders: {},
      status: 201,
      statusText: "Created",
    }]);
    expect(JSON.stringify(capture)).not.toContain("must-not-leak");
    expect(JSON.stringify(capture)).not.toContain("evil.example");
  });
});

function capabilities(): MimikaBrowserCapabilities {
  return {
    status: "ok",
    protocol: MIMIKA_BROWSER_PROTOCOL,
    protocol_version: MIMIKA_BROWSER_PROTOCOL_VERSION,
    endpoints: {
      actions: "/daemon/mikacli/browser/action",
      grants: "/daemon/mikacli/browser/grants",
      session_export: "/daemon/browser/session/export",
    },
    browser: {
      configured: true,
      connected: true,
      backend: "native-cdp",
      tab_count: 1,
    },
    capabilities: {
      actions: ["browser_tabs", "browser_script", "browser_navigate", "browser_keyboard", "browser_file_upload"],
      explicit_user_grant: true,
      one_tab_session_grant: true,
      origin_scoped_page_actions: true,
      origin_scoped_session_export: true,
      raw_cdp_exposed: false,
      local_browser_fallback: false,
    },
  };
}

function sessionResponse(input: {
  origin: string;
  current_url: string;
  cookies: unknown[];
}): {
  status: "ok";
  protocol: typeof MIMIKA_BROWSER_PROTOCOL;
  protocol_version: typeof MIMIKA_BROWSER_PROTOCOL_VERSION;
  session: MimikaBrowserSession;
} {
  return {
    status: "ok",
    protocol: MIMIKA_BROWSER_PROTOCOL,
    protocol_version: MIMIKA_BROWSER_PROTOCOL_VERSION,
    session: {
      protocol: MIMIKA_BROWSER_PROTOCOL,
      protocol_version: MIMIKA_BROWSER_PROTOCOL_VERSION,
      origin: input.origin,
      current_url: input.current_url,
      cookies: input.cookies,
      local_storage: {},
      session_storage: {},
    },
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

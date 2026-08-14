import { MikaCliError } from "../errors.js";

export const MIMIKA_BROWSER_PROTOCOL = "mimika-browser-broker";
export const MIMIKA_BROWSER_PROTOCOL_VERSION = 1;
export const MIMIKA_BROWSER_PROFILE_URI = "mimika://browser";
export const MIMIKA_MANAGED_ENV = "MIMIKA_MIKACLI_MANAGED";
export const MIMIKA_BROWSER_GATEWAY_URL_ENV = "MIMIKA_BROWSER_GATEWAY_URL";
export const MIMIKA_BROWSER_GATEWAY_TOKEN_ENV = "MIMIKA_BROWSER_GATEWAY_TOKEN";
export const MIMIKA_BROWSER_CONNECT_GRANT_ENV = "MIMIKA_BROWSER_CONNECT_GRANT";
export const MIMIKA_BROWSER_CONNECT_PLATFORM_ENV = "MIMIKA_BROWSER_CONNECT_PLATFORM";
export const MIMIKA_BROWSER_GRANT_HEADER = "X-Mimika-Browser-Grant";
export const MIMIKA_BROWSER_PLATFORM_HEADER = "X-Mimika-Browser-Platform";

const CAPABILITIES_ENDPOINT = "/daemon/browser/capabilities";
const ACTION_ENDPOINT = "/daemon/mikacli/browser/action";
const SESSION_EXPORT_ENDPOINT = "/daemon/browser/session/export";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type MimikaBrowserCapabilities = {
  status: "ok";
  protocol: typeof MIMIKA_BROWSER_PROTOCOL;
  protocol_version: typeof MIMIKA_BROWSER_PROTOCOL_VERSION;
  endpoints: {
    actions: typeof ACTION_ENDPOINT;
    grants: "/daemon/mikacli/browser/grants";
    session_export: typeof SESSION_EXPORT_ENDPOINT;
  };
  browser: {
    configured: boolean;
    connected: boolean;
    backend: string;
    runtime_mode?: string;
    using_external_browser?: boolean;
    headless?: boolean;
    tab_count?: number;
  };
  capabilities: {
    actions: string[];
    explicit_user_grant: true;
    one_tab_session_grant: true;
    origin_scoped_page_actions: true;
    origin_scoped_session_export: true;
    raw_cdp_exposed: false;
    local_browser_fallback: false;
  };
};

export type MimikaBrowserSession = {
  protocol: typeof MIMIKA_BROWSER_PROTOCOL;
  protocol_version: typeof MIMIKA_BROWSER_PROTOCOL_VERSION;
  origin: string;
  current_url: string;
  cookies: unknown[];
  local_storage: Record<string, string>;
  session_storage: Record<string, string>;
};

export type MimikaBrowserTabHandle = `ext:${string}` | `pw:${string}` | `cdp:${string}`;

export interface MimikaBrowserGateway {
  getCapabilities(): Promise<MimikaBrowserCapabilities>;
  openTab(url: string, timeoutMs?: number): Promise<MimikaBrowserTabHandle>;
  closeTab(tabHandle: MimikaBrowserTabHandle): Promise<void>;
  exportOriginSession(origin: string, tabHandle?: MimikaBrowserTabHandle): Promise<MimikaBrowserSession>;
}

export function isMimikaManagedMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[MIMIKA_MANAGED_ENV]?.trim() === "1";
}

export function hasMimikaBrowserGatewayEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env[MIMIKA_BROWSER_GATEWAY_URL_ENV]?.trim() &&
    env[MIMIKA_BROWSER_GATEWAY_TOKEN_ENV]?.trim(),
  );
}

export function assertMimikaRichBrowserUnsupported(operation: string): void {
  if (!isMimikaManagedMode()) return;

  throw new MikaCliError(
    "MIMIKA_BROWSER_PAGE_FACADE_UNSUPPORTED",
    `${operation} needs a Playwright Page workflow that the managed Mimika browser broker does not expose. MikaCLI will not launch or attach to another browser in managed mode.`,
    {
      details: {
        operation,
        managed: true,
        browserOwner: "mimika",
        localBrowserFallback: false,
      },
    },
  );
}

export function normalizeMimikaBrowserOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch (error) {
    throw new MikaCliError(
      "MIMIKA_BROWSER_INVALID_ORIGIN",
      "Mimika browser session export requires an absolute URL.",
      { cause: error },
    );
  }

  if (url.username || url.password) {
    throw new MikaCliError(
      "MIMIKA_BROWSER_INVALID_ORIGIN",
      "Mimika browser session export does not allow credentials in URLs.",
    );
  }

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new MikaCliError(
      "MIMIKA_BROWSER_INSECURE_ORIGIN",
      "Mimika browser session export requires HTTPS, except for loopback development origins.",
      { details: { origin: url.origin } },
    );
  }

  return url.origin;
}

export class MimikaBrowserGatewayClient implements MimikaBrowserGateway {
  readonly baseUrl: URL;
  readonly requestTimeoutMs: number;
  readonly fetchFn: FetchLike;
  #token: string;
  #connectGrant?: string;
  #connectPlatform?: string;

  constructor(input: {
    gatewayUrl: string;
    token: string;
    connectGrant?: string;
    connectPlatform?: string;
    requestTimeoutMs?: number;
    fetchFn?: FetchLike;
  }) {
    this.baseUrl = validateGatewayUrl(input.gatewayUrl);
    this.#token = input.token.trim();
    if (!this.#token) {
      throw missingGatewayConfigurationError(MIMIKA_BROWSER_GATEWAY_TOKEN_ENV);
    }
    this.#connectGrant = input.connectGrant?.trim();
    this.#connectPlatform = input.connectPlatform?.trim();
    this.requestTimeoutMs = Math.max(250, input.requestTimeoutMs ?? 30_000);
    this.fetchFn = input.fetchFn ?? fetch;
  }

  static fromEnvironment(
    env: NodeJS.ProcessEnv = process.env,
    input: { requestTimeoutMs?: number; fetchFn?: FetchLike } = {},
  ): MimikaBrowserGatewayClient {
    const gatewayUrl = env[MIMIKA_BROWSER_GATEWAY_URL_ENV]?.trim();
    const token = env[MIMIKA_BROWSER_GATEWAY_TOKEN_ENV]?.trim();
    if (!gatewayUrl) throw missingGatewayConfigurationError(MIMIKA_BROWSER_GATEWAY_URL_ENV);
    if (!token) throw missingGatewayConfigurationError(MIMIKA_BROWSER_GATEWAY_TOKEN_ENV);
    return new MimikaBrowserGatewayClient({
      gatewayUrl,
      token,
      connectGrant: env[MIMIKA_BROWSER_CONNECT_GRANT_ENV],
      connectPlatform: env[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV],
      requestTimeoutMs: input.requestTimeoutMs,
      fetchFn: input.fetchFn,
    });
  }

  async getCapabilities(): Promise<MimikaBrowserCapabilities> {
    const raw = await this.#requestJson(CAPABILITIES_ENDPOINT, { method: "GET" });
    const value = requireObject(raw, "Mimika browser capabilities");
    assertProtocol(value, "Mimika browser capabilities");

    const endpoints = requireObject(value.endpoints, "Mimika browser capability endpoints");
    const browser = requireObject(value.browser, "Mimika browser capability state");
    const capabilities = requireObject(value.capabilities, "Mimika browser capability flags");
    const actions = Array.isArray(capabilities.actions)
      ? capabilities.actions.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (
      value.status !== "ok" ||
      endpoints.actions !== ACTION_ENDPOINT ||
      endpoints.grants !== "/daemon/mikacli/browser/grants" ||
      endpoints.session_export !== SESSION_EXPORT_ENDPOINT ||
      capabilities.explicit_user_grant !== true ||
      capabilities.one_tab_session_grant !== true ||
      capabilities.origin_scoped_page_actions !== true ||
      capabilities.origin_scoped_session_export !== true ||
      capabilities.raw_cdp_exposed !== false ||
      capabilities.local_browser_fallback !== false ||
      !["browser_tabs", "browser_script", "browser_navigate", "browser_keyboard", "browser_file_upload"]
        .every((action) => actions.includes(action))
    ) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_INCOMPATIBLE",
        "The Mimika browser gateway does not provide the required origin-scoped, no-fallback browser contract.",
      );
    }

    return {
      status: "ok",
      protocol: MIMIKA_BROWSER_PROTOCOL,
      protocol_version: MIMIKA_BROWSER_PROTOCOL_VERSION,
      endpoints: {
        actions: ACTION_ENDPOINT,
        grants: "/daemon/mikacli/browser/grants",
        session_export: SESSION_EXPORT_ENDPOINT,
      },
      browser: {
        configured: browser.configured === true,
        connected: browser.connected === true,
        backend: typeof browser.backend === "string" ? browser.backend : "unknown",
        ...(typeof browser.runtime_mode === "string" ? { runtime_mode: browser.runtime_mode } : {}),
        ...(typeof browser.using_external_browser === "boolean"
          ? { using_external_browser: browser.using_external_browser }
          : {}),
        ...(typeof browser.headless === "boolean" ? { headless: browser.headless } : {}),
        ...(typeof browser.tab_count === "number" ? { tab_count: browser.tab_count } : {}),
      },
      capabilities: {
        actions,
        explicit_user_grant: true,
        one_tab_session_grant: true,
        origin_scoped_page_actions: true,
        origin_scoped_session_export: true,
        raw_cdp_exposed: false,
        local_browser_fallback: false,
      },
    };
  }

  async openTab(url: string, timeoutMs?: number): Promise<MimikaBrowserTabHandle> {
    const target = validateBrowserTargetUrl(url);
    const result = await this.#runAction({
      action: "browser_tabs",
      tabs_action: "new",
      broker_protocol: MIMIKA_BROWSER_PROTOCOL_VERSION,
      url: target,
      ...(timeoutMs ? { timeout: Math.max(1, Math.round(timeoutMs)) } : {}),
    });
    const match = result.stdout.match(
      /(?:^|\n)Opened broker tab\s+((?:ext|pw|cdp):[A-Za-z0-9_-]+):/u,
    );
    const tabHandle = match?.[1];
    if (!tabHandle || !isMimikaBrowserTabHandle(tabHandle)) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_INVALID_RESPONSE",
        "Mimika opened the login page but did not return a valid opaque broker tab handle.",
      );
    }
    return tabHandle;
  }

  async closeTab(tabHandle: MimikaBrowserTabHandle): Promise<void> {
    assertTabHandle(tabHandle);
    await this.#runAction({
      action: "browser_tabs",
      tabs_action: "close",
      tab_handle: tabHandle,
    });
  }

  async exportOriginSession(
    origin: string,
    tabHandle?: MimikaBrowserTabHandle,
  ): Promise<MimikaBrowserSession> {
    const approvedOrigin = normalizeMimikaBrowserOrigin(origin);
    if (tabHandle !== undefined) assertTabHandle(tabHandle);

    const raw = await this.#requestJson(SESSION_EXPORT_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        origin: approvedOrigin,
        ...(tabHandle !== undefined ? { tab_handle: tabHandle } : {}),
        include_local_storage: true,
        include_session_storage: true,
      }),
    }, true);
    const value = requireObject(raw, "Mimika browser session response");
    assertProtocol(value, "Mimika browser session response");
    if (value.status !== "ok") {
      throw invalidResponseError("Mimika browser session response did not report success.");
    }

    const session = requireObject(value.session, "Mimika browser session");
    assertProtocol(session, "Mimika browser session");
    if (session.origin !== approvedOrigin) {
      throw scopeViolationError(approvedOrigin, "The returned session origin did not match the requested origin.");
    }
    if (typeof session.current_url !== "string" || originOf(session.current_url) !== approvedOrigin) {
      throw scopeViolationError(approvedOrigin, "The returned browser tab was not on the requested origin.");
    }
    if (!Array.isArray(session.cookies)) {
      throw invalidResponseError("Mimika browser session cookies were not an array.");
    }

    const hostname = new URL(approvedOrigin).hostname.toLowerCase();
    for (const cookie of session.cookies) {
      if (!cookieAppliesToHost(cookie, hostname)) {
        throw scopeViolationError(
          approvedOrigin,
          "Mimika returned a cookie outside the requested origin scope; the entire export was rejected.",
        );
      }
    }

    return {
      protocol: MIMIKA_BROWSER_PROTOCOL,
      protocol_version: MIMIKA_BROWSER_PROTOCOL_VERSION,
      origin: approvedOrigin,
      current_url: session.current_url,
      cookies: session.cookies,
      local_storage: requireStringRecord(session.local_storage, "Mimika local storage"),
      session_storage: requireStringRecord(session.session_storage, "Mimika session storage"),
    };
  }

  async runPageAction(
    origin: string,
    tabHandle: MimikaBrowserTabHandle,
    payload: Record<string, unknown>,
  ): Promise<{
    exit_code: number;
    stdout: string;
    stderr: string;
    duration_ms: number;
  }> {
    const approvedOrigin = normalizeMimikaBrowserOrigin(origin);
    assertTabHandle(tabHandle);
    const action = typeof payload.action === "string" ? payload.action : "";
    if (!["browser_script", "browser_navigate", "browser_keyboard", "browser_file_upload"].includes(action)) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_ACTION_UNSUPPORTED",
        "The managed Page facade requested an action outside Mimika's bounded browser contract.",
        { details: { action } },
      );
    }
    if (action === "browser_navigate") {
      const target = typeof payload.url === "string" ? validateBrowserTargetUrl(payload.url) : "";
      if (!target || normalizeMimikaBrowserOrigin(target) !== approvedOrigin) {
        throw new MikaCliError(
          "MIMIKA_BROWSER_SCOPE_VIOLATION",
          "Managed Page navigation cannot leave the approved platform origin.",
          { details: { origin: approvedOrigin } },
        );
      }
    }
    return this.#runAction({
      ...payload,
      action,
      origin: approvedOrigin,
      tab_handle: tabHandle,
    });
  }

  async #runAction(payload: Record<string, unknown>): Promise<{
    exit_code: number;
    stdout: string;
    stderr: string;
    duration_ms: number;
  }> {
    const raw = await this.#requestJson(ACTION_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    }, true);
    const result = requireObject(raw, "Mimika browser action result");
    if (
      typeof result.exit_code !== "number" ||
      typeof result.stdout !== "string" ||
      typeof result.stderr !== "string" ||
      typeof result.duration_ms !== "number"
    ) {
      throw invalidResponseError("Mimika browser action returned an invalid result.");
    }
    if (result.exit_code !== 0) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_ACTION_FAILED",
        result.stderr.trim() || "Mimika could not complete the browser action.",
        { details: { action: payload.action, exitCode: result.exit_code } },
      );
    }
    return {
      exit_code: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: result.duration_ms,
    };
  }

  async #requestJson(endpoint: string, init: RequestInit, requiresConsent = false): Promise<unknown> {
    const consentHeaders = requiresConsent ? this.#consentHeaders() : {};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response: Response;
    let body: string;
    try {
      response = await this.fetchFn(new URL(endpoint, this.baseUrl), {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#token}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...consentHeaders,
        },
      });
      body = await response.text();
    } catch (error) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_GATEWAY_UNAVAILABLE",
        "MikaCLI could not reach Mimika's managed browser gateway.",
        { cause: error, details: { endpoint } },
      );
    } finally {
      clearTimeout(timer);
    }

    if (body.length > MAX_RESPONSE_BYTES) {
      throw invalidResponseError("Mimika browser gateway returned an oversized response.");
    }
    let parsed: unknown;
    try {
      parsed = body ? JSON.parse(body) : null;
    } catch (error) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_INVALID_RESPONSE",
        "Mimika browser gateway returned invalid JSON.",
        { cause: error, details: { endpoint, httpStatus: response.status } },
      );
    }

    if (!response.ok) {
      const errorBody = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
      const message = typeof errorBody.error === "string"
        ? errorBody.error
        : `Mimika browser gateway request failed with HTTP ${response.status}.`;
      throw new MikaCliError(
        response.status === 409
          ? "MIMIKA_BROWSER_ORIGIN_MISMATCH"
          : "MIMIKA_BROWSER_GATEWAY_UNAVAILABLE",
        message,
        {
          details: {
            endpoint,
            httpStatus: response.status,
            ...(typeof errorBody.code === "string" ? { gatewayCode: errorBody.code } : {}),
          },
        },
      );
    }

    return parsed;
  }

  #consentHeaders(): Record<string, string> {
    const grant = this.#connectGrant;
    const platform = this.#connectPlatform;
    if (!grant || !platform || !/^[0-9a-f]{64}$/u.test(grant) ||
      platform.length > 128 || !/^[a-z0-9._-]+$/u.test(platform)) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_CONSENT_REQUIRED",
        "Managed browser login requires a valid request-scoped Mimika Connect grant; MikaCLI will not fall back to a local browser.",
        { details: { localBrowserFallback: false } },
      );
    }
    return {
      [MIMIKA_BROWSER_GRANT_HEADER]: grant,
      [MIMIKA_BROWSER_PLATFORM_HEADER]: platform,
    };
  }
}

function validateGatewayUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch (error) {
    throw new MikaCliError(
      "MIMIKA_BROWSER_GATEWAY_CONFIG_INVALID",
      `${MIMIKA_BROWSER_GATEWAY_URL_ENV} must be an absolute URL.`,
      { cause: error },
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "") ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname)))
  ) {
    throw new MikaCliError(
      "MIMIKA_BROWSER_GATEWAY_CONFIG_INVALID",
      `${MIMIKA_BROWSER_GATEWAY_URL_ENV} must be an HTTPS base URL or an HTTP loopback base URL, without credentials or a path.`,
    );
  }

  url.pathname = "/";
  return url;
}

function validateBrowserTargetUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch (error) {
    throw new MikaCliError("MIMIKA_BROWSER_INVALID_URL", "Mimika browser actions require an absolute URL.", { cause: error });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new MikaCliError("MIMIKA_BROWSER_INVALID_URL", "Mimika browser actions support only HTTP and HTTPS URLs.");
  }
  return url.href;
}

function assertProtocol(value: Record<string, unknown>, label: string): void {
  if (
    value.protocol !== MIMIKA_BROWSER_PROTOCOL ||
    value.protocol_version !== MIMIKA_BROWSER_PROTOCOL_VERSION
  ) {
    throw new MikaCliError(
      "MIMIKA_BROWSER_PROTOCOL_MISMATCH",
      `${label} uses an unsupported protocol or version.`,
      {
        details: {
          expectedProtocol: MIMIKA_BROWSER_PROTOCOL,
          expectedVersion: MIMIKA_BROWSER_PROTOCOL_VERSION,
        },
      },
    );
  }
}

function assertTabHandle(tabHandle: string): asserts tabHandle is MimikaBrowserTabHandle {
  if (!isMimikaBrowserTabHandle(tabHandle)) {
    throw new MikaCliError(
      "MIMIKA_BROWSER_INVALID_TAB",
      "Mimika browser tab handles must use the opaque ext:, pw:, or cdp: broker format.",
    );
  }
}

function isMimikaBrowserTabHandle(value: string): value is MimikaBrowserTabHandle {
  return value.length <= 256 && /^(?:ext|pw|cdp):[A-Za-z0-9_-]+$/u.test(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidResponseError(`${label} was not a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function requireStringRecord(value: unknown, label: string): Record<string, string> {
  const object = requireObject(value, label);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(object)) {
    if (typeof entry !== "string") {
      throw invalidResponseError(`${label} contained a non-string value.`);
    }
    result[key] = entry;
  }
  return result;
}

function cookieAppliesToHost(cookie: unknown, hostname: string): boolean {
  if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) return false;
  const domain = "domain" in cookie && typeof cookie.domain === "string"
    ? cookie.domain.trim().replace(/^\./u, "").toLowerCase()
    : "";
  return Boolean(domain) && (hostname === domain || hostname.endsWith(`.${domain}`));
}

function originOf(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function missingGatewayConfigurationError(variable: string): MikaCliError {
  return new MikaCliError(
    "MIMIKA_BROWSER_GATEWAY_NOT_CONFIGURED",
    `Managed mode requires ${variable}; MikaCLI will not fall back to a local browser.`,
    { details: { variable, localBrowserFallback: false } },
  );
}

function invalidResponseError(message: string): MikaCliError {
  return new MikaCliError("MIMIKA_BROWSER_INVALID_RESPONSE", message);
}

function scopeViolationError(origin: string, message: string): MikaCliError {
  return new MikaCliError(
    "MIMIKA_BROWSER_SCOPE_VIOLATION",
    message,
    { details: { origin, exportRejected: true } },
  );
}

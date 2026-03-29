import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";

import { AutoCliError } from "../../../errors.js";
import {
  PLATFORM_CONFIG,
  PLATFORM_NAMES,
  getPlatformCookieDomain,
  getPlatformDisplayName,
  getPlatformHomeUrl,
  getPlatformOrigin,
  isPlatform,
} from "../../config.js";
import { normalizePublicHttpUrl } from "../shared/url.js";
import { CookieManager, createCookieJarFromBrowserCookies } from "../../../utils/cookie-manager.js";
import { captureSharedBrowserNetwork, inspectSharedBrowserTarget } from "../../../utils/browser-cookie-login.js";

import type { AdapterActionResult, Platform, PlatformSession } from "../../../types.js";

export type SessionHttpInspectInput = {
  target: string;
  account?: string;
  platform?: string;
  browser?: boolean;
  browserTimeoutSeconds?: number;
};

export type SessionHttpCaptureInput = {
  target: string;
  account?: string;
  platform?: string;
  browserTimeoutSeconds?: number;
  limit?: number;
  filter?: string;
  summary?: boolean;
  groupBy?: SessionHttpCaptureGroupBy;
};

export type SessionHttpRequestInput = {
  target: string;
  method: string;
  pathOrUrl: string;
  account?: string;
  platform?: string;
  browser?: boolean;
  browserTimeoutSeconds?: number;
  timeoutMs?: number;
  body?: string;
  jsonBody?: string;
  headers?: string[];
};

type ResolvedTarget = {
  rawTarget: string;
  hostname: string;
  inputUrl?: string;
  platform?: Platform;
  displayName: string;
  cookieDomain: string;
  baseUrl: string;
  startUrl: string;
  session: LoadedSession | null;
  candidates: Platform[];
};

type LoadedSession = {
  path: string;
  session: PlatformSession;
  jar: CookieJar;
};

type RequestBody = {
  body?: string;
  contentType?: string;
};

export type SessionHttpCaptureGroupBy = "endpoint" | "full-url" | "method" | "status";

type RequestResponsePayload = {
  requestUrl: string;
  status: number;
  statusText: string;
  redirected: boolean;
  finalUrl: string;
  method: string;
  contentType: string | null;
  headers: Record<string, string>;
  body: unknown;
  bodyText?: string;
};

const SESSION_CAPABLE_PLATFORMS = PLATFORM_NAMES.filter((platform) => {
  const config = PLATFORM_CONFIG[platform];
  return (
    config.authCookieNames.length > 0 ||
    (config.browserAuthCookieNames?.length ?? 0) > 0 ||
    (config.browserAuthStorageKeys?.length ?? 0) > 0
  );
}) as Platform[];

const DEFAULT_CAPTURE_TIMEOUT_SECONDS = 60;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/vkop007/autocli)";

export class SessionHttpAdapter {
  readonly platform = "http" as Platform;
  readonly displayName = "HTTP Toolkit";

  private readonly cookieManager = new CookieManager();

  async inspect(input: SessionHttpInspectInput): Promise<AdapterActionResult> {
    const resolved = await this.resolveTarget({
      rawTarget: input.target,
      platformOverride: input.platform,
      account: input.account,
    });

    const sessionData = resolved.session
      ? await this.buildSessionInspection(resolved.session, resolved.cookieDomain, resolved.platform)
      : {
          available: false,
        };

    const browserData = input.browser
      ? await this.inspectBrowserState({
          resolved,
          timeoutSeconds: input.browserTimeoutSeconds,
        })
      : undefined;

    const candidateIds = resolved.candidates.map((candidate) => candidate);
    const message = resolved.session
      ? `Inspected ${resolved.displayName} session for ${resolved.session.session.account}.`
      : `Inspected HTTP target ${resolved.hostname}.`;

    return {
      ok: true,
      platform: this.platform,
      account: resolved.session?.session.account ?? "public",
      action: "inspect",
      message,
      url: resolved.startUrl,
      sessionPath: resolved.session?.path,
      user: resolved.session?.session.user,
      data: {
        target: resolved.rawTarget,
        hostname: resolved.hostname,
        resolvedPlatform: resolved.platform,
        displayName: resolved.displayName,
        cookieDomain: resolved.cookieDomain,
        baseUrl: resolved.baseUrl,
        startUrl: resolved.startUrl,
        session: sessionData,
        browser: browserData,
        candidates: candidateIds,
      },
    };
  }

  async capture(input: SessionHttpCaptureInput): Promise<AdapterActionResult> {
    const resolved = await this.resolveTarget({
      rawTarget: input.target,
      platformOverride: input.platform,
      account: input.account,
    });

    const capture = await captureSharedBrowserNetwork({
      targetUrl: resolved.startUrl,
      timeoutSeconds: input.browserTimeoutSeconds ?? DEFAULT_CAPTURE_TIMEOUT_SECONDS,
      filterDomain: resolved.hostname,
      filterText: input.filter,
      limit: input.limit,
    });
    const groupBy = normalizeCaptureGroupBy(input.groupBy);
    const summary = input.summary || input.groupBy
      ? summarizeCapturedRequests(capture.requests, groupBy)
      : undefined;
    const groupLabel = groupBy === "full-url" ? "URL" : groupBy;
    const message = summary
      ? `Captured ${capture.requests.length} requests across ${summary.groups.length} ${groupLabel} group${summary.groups.length === 1 ? "" : "s"} for ${resolved.hostname}.`
      : `Captured ${capture.requests.length} request${capture.requests.length === 1 ? "" : "s"} for ${resolved.hostname}.`;

    return {
      ok: true,
      platform: this.platform,
      account: resolved.session?.session.account ?? "browser",
      action: "capture",
      message,
      url: capture.finalUrl,
      sessionPath: resolved.session?.path,
      user: resolved.session?.session.user,
      data: {
        target: resolved.rawTarget,
        hostname: resolved.hostname,
        resolvedPlatform: resolved.platform,
        browserProfilePath: capture.browserProfilePath,
        finalUrl: capture.finalUrl,
        timedOut: capture.timedOut,
        launchedFresh: capture.launchedFresh,
        groupBy: summary ? groupBy : undefined,
        summary,
        requests: capture.requests,
      },
    };
  }

  async request(input: SessionHttpRequestInput): Promise<AdapterActionResult> {
    const resolved = await this.resolveTarget({
      rawTarget: input.target,
      platformOverride: input.platform,
      account: input.account,
      requireResolvablePlatform: !input.browser,
    });
    const requestUrl = buildRequestUrl(input.pathOrUrl, resolved.baseUrl);
    const method = normalizeHttpMethod(input.method);
    const body = parseRequestBody(input.body, input.jsonBody);

    const sessionJar = await this.resolveRequestJar({
      resolved,
      requestUrl,
      useBrowserCookies: Boolean(input.browser),
      browserTimeoutSeconds: input.browserTimeoutSeconds,
    });

    const payload = await this.executeSessionRequest({
      jar: sessionJar.jar,
      baseUrl: resolved.baseUrl,
      requestUrl,
      method,
      timeoutMs: clampNumber(input.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, 1_000, 120_000),
      headers: input.headers ?? [],
      body,
    });

    return {
      ok: true,
      platform: this.platform,
      account: resolved.session?.session.account ?? (input.browser ? "browser" : "default"),
      action: "request",
      message: `Received ${payload.status} ${payload.statusText || "response"} from ${payload.finalUrl}.`,
      url: payload.finalUrl,
      sessionPath: resolved.session?.path,
      user: resolved.session?.session.user,
      data: {
        target: resolved.rawTarget,
        hostname: resolved.hostname,
        resolvedPlatform: resolved.platform,
        baseUrl: resolved.baseUrl,
        requestUrl: payload.requestUrl,
        method: payload.method,
        status: payload.status,
        statusText: payload.statusText,
        redirected: payload.redirected,
        finalUrl: payload.finalUrl,
        contentType: payload.contentType,
        headers: payload.headers,
        body: payload.body,
        bodyText: payload.bodyText,
        usedBrowserCookies: sessionJar.usedBrowserCookies,
      },
    };
  }

  private async resolveTarget(input: {
    rawTarget: string;
    platformOverride?: string;
    account?: string;
    requireResolvablePlatform?: boolean;
  }): Promise<ResolvedTarget> {
    const platformOverride = input.platformOverride?.trim();
    if (platformOverride) {
      if (!isPlatform(platformOverride)) {
        throw new AutoCliError("TOOLS_HTTP_PLATFORM_INVALID", `Unknown platform "${platformOverride}".`);
      }

      return this.resolvePlatformTarget(platformOverride, input.rawTarget, input.account);
    }

    const rawTarget = input.rawTarget.trim();
    if (!rawTarget) {
      throw new AutoCliError("TOOLS_HTTP_TARGET_REQUIRED", "Provide a provider name, domain, or URL.");
    }

    if (isPlatform(rawTarget)) {
      return this.resolvePlatformTarget(rawTarget, rawTarget, input.account);
    }

    const inputUrl = normalizePublicHttpUrl(rawTarget);
    const parsedUrl = new URL(inputUrl);
    const hostname = parsedUrl.hostname.replace(/^\./u, "");
    const candidates = rankHttpPlatformCandidates(hostname, inputUrl);

    if (candidates.length === 1) {
      return this.resolvePlatformTarget(candidates[0]!, rawTarget, input.account, inputUrl);
    }

    if (candidates.length > 1) {
      const preferred = await this.selectPreferredCandidate(candidates, input.account);
      if (preferred) {
        return this.resolvePlatformTarget(preferred, rawTarget, input.account, inputUrl);
      }

      if (input.requireResolvablePlatform) {
        throw new AutoCliError(
          "TOOLS_HTTP_TARGET_AMBIGUOUS",
          `The target "${rawTarget}" matches multiple providers. Re-run with --platform ${candidates[0]} or another explicit provider.`,
          {
            details: {
              target: rawTarget,
              candidates,
            },
          },
        );
      }
    }

    if (input.requireResolvablePlatform) {
      throw new AutoCliError(
        "TOOLS_HTTP_PLATFORM_REQUIRED",
        `AutoCLI could not resolve "${rawTarget}" to a saved-session provider. Pass a provider name like "github" or use --platform.`,
      );
    }

    return {
      rawTarget,
      hostname,
      inputUrl,
      displayName: hostname,
      cookieDomain: hostname,
      baseUrl: `${parsedUrl.protocol}//${parsedUrl.host}/`,
      startUrl: inputUrl,
      session: null,
      candidates,
    };
  }

  private async resolvePlatformTarget(
    platform: Platform,
    rawTarget: string,
    account?: string,
    inputUrl?: string,
  ): Promise<ResolvedTarget> {
    const session = await this.tryLoadSession(platform, account);
    const baseUrl = getSessionBaseUrl(platform, session?.session);
    const startUrl = inputUrl ?? baseUrl;
    const startHostname = new URL(startUrl).hostname.replace(/^\./u, "");

    return {
      rawTarget,
      hostname: startHostname,
      inputUrl,
      platform,
      displayName: getPlatformDisplayName(platform),
      cookieDomain: session?.session.metadata && typeof session.session.metadata.siteUrl === "string"
        ? new URL(String(session.session.metadata.siteUrl)).hostname.replace(/^\./u, "")
        : getPlatformCookieDomain(platform),
      baseUrl,
      startUrl,
      session,
      candidates: [platform],
    };
  }

  private async tryLoadSession(platform: Platform, account?: string): Promise<LoadedSession | null> {
    try {
      const loaded = await this.cookieManager.loadSession(platform, account);
      return {
        path: loaded.path,
        session: loaded.session,
        jar: await this.cookieManager.createJar(loaded.session),
      };
    } catch {
      return null;
    }
  }

  private async selectPreferredCandidate(candidates: readonly Platform[], account?: string): Promise<Platform | null> {
    const withSavedSession: Platform[] = [];
    for (const candidate of candidates) {
      const session = await this.tryLoadSession(candidate, account);
      if (session) {
        withSavedSession.push(candidate);
      }
    }

    return withSavedSession.length === 1 ? withSavedSession[0]! : null;
  }

  private async buildSessionInspection(
    loaded: LoadedSession,
    cookieDomain: string,
    platform?: Platform,
  ): Promise<Record<string, unknown>> {
    const serialized = loaded.jar.toJSON() ?? { cookies: [] };
    const cookies = Array.isArray(serialized.cookies) ? serialized.cookies : [];
    const matchingCookies = cookies.filter((cookie) => {
      const domain = typeof cookie.domain === "string" ? cookie.domain.replace(/^\./u, "") : "";
      return domain === cookieDomain || domain.endsWith(`.${cookieDomain}`) || cookieDomain.endsWith(`.${domain}`);
    });

    const authCookieNames = platform ? Array.from(PLATFORM_CONFIG[platform].authCookieNames) : [];
    const presentAuthCookies = authCookieNames.filter((name) =>
      matchingCookies.some((cookie) => typeof cookie.key === "string" && matchesCookiePattern(cookie.key, name)),
    );

    return {
      available: true,
      account: loaded.session.account,
      sessionPath: loaded.path,
      status: loaded.session.status,
      updatedAt: loaded.session.updatedAt,
      source: loaded.session.source,
      cookieCount: cookies.length,
      matchingCookieCount: matchingCookies.length,
      authCookieNames,
      presentAuthCookies,
      missingAuthCookies: authCookieNames.filter((name) => !presentAuthCookies.includes(name)),
      metadata: loaded.session.metadata ?? {},
    };
  }

  private async inspectBrowserState(input: {
    resolved: ResolvedTarget;
    timeoutSeconds?: number;
  }): Promise<Record<string, unknown>> {
    const inspection = await inspectSharedBrowserTarget({
      targetUrl: input.resolved.startUrl,
      timeoutSeconds: input.timeoutSeconds,
    });

    const matchingCookies = inspection.cookies.filter((cookie) => {
      if (!cookie || typeof cookie !== "object") {
        return false;
      }

      const domain = "domain" in cookie && typeof cookie.domain === "string"
        ? cookie.domain.replace(/^\./u, "")
        : "";
      const hostname = input.resolved.hostname.replace(/^\./u, "");
      return domain === hostname || domain.endsWith(`.${hostname}`) || hostname.endsWith(`.${domain}`);
    });

    return {
      browserProfilePath: inspection.browserProfilePath,
      finalUrl: inspection.finalUrl,
      launchedFresh: inspection.launchedFresh,
      cookieCount: inspection.cookies.length,
      matchingCookieCount: matchingCookies.length,
      localStorageKeys: Object.keys(inspection.localStorage).sort((left, right) => left.localeCompare(right)),
      sessionStorageKeys: Object.keys(inspection.sessionStorage).sort((left, right) => left.localeCompare(right)),
    };
  }

  private async resolveRequestJar(input: {
    resolved: ResolvedTarget;
    requestUrl: string;
    useBrowserCookies: boolean;
    browserTimeoutSeconds?: number;
  }): Promise<{ jar: CookieJar; usedBrowserCookies: boolean }> {
    if (input.useBrowserCookies) {
      const inspection = await inspectSharedBrowserTarget({
        targetUrl: input.resolved.startUrl,
        timeoutSeconds: input.browserTimeoutSeconds ?? 60,
      });

      return {
        jar: await createCookieJarFromBrowserCookies(inspection.cookies, input.resolved.cookieDomain),
        usedBrowserCookies: true,
      };
    }

    if (!input.resolved.session) {
      throw new AutoCliError(
        "TOOLS_HTTP_SESSION_REQUIRED",
        `No saved session was found for ${input.resolved.displayName}. Log in first or retry with --browser to borrow cookies from the shared browser profile.`,
      );
    }

    return {
      jar: input.resolved.session.jar,
      usedBrowserCookies: false,
    };
  }

  private async executeSessionRequest(input: {
    jar: CookieJar;
    baseUrl: string;
    requestUrl: string;
    method: string;
    timeoutMs: number;
    headers: string[];
    body: RequestBody;
  }): Promise<RequestResponsePayload> {
    const cookieFetch = makeFetchCookie(fetch, input.jar, true);
    const headers = await buildRequestHeaders({
      jar: input.jar,
      requestUrl: input.requestUrl,
      baseUrl: input.baseUrl,
      headerInputs: input.headers,
      contentType: input.body.contentType,
    });

    const response = await cookieFetch(input.requestUrl, {
      method: input.method,
      headers,
      body: input.body.body,
      redirect: "follow",
      signal: AbortSignal.timeout(input.timeoutMs),
    }).catch((error) => {
      throw new AutoCliError("TOOLS_HTTP_REQUEST_FAILED", "Failed to perform the authenticated HTTP request.", {
        cause: error,
        details: {
          requestUrl: input.requestUrl,
          method: input.method,
        },
      });
    });

    const contentType = response.headers.get("content-type");
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value;
    }

    const text = await response.text();
    const body = parseResponseBody(text, contentType);

    return {
      requestUrl: input.requestUrl,
      status: response.status,
      statusText: response.statusText,
      redirected: response.redirected,
      finalUrl: response.url || input.requestUrl,
      method: input.method,
      contentType,
      headers: responseHeaders,
      body,
      bodyText: typeof body === "string" ? body : text,
    };
  }
}

export const sessionHttpAdapter = new SessionHttpAdapter();

export function rankHttpPlatformCandidates(hostname: string, targetUrl?: string): Platform[] {
  const normalizedHostname = hostname.replace(/^\./u, "").toLowerCase();
  const pathname = targetUrl ? safePathname(targetUrl) : "";

  return [...SESSION_CAPABLE_PLATFORMS]
    .map((platform) => ({
      platform,
      score: scorePlatformMatch(platform, normalizedHostname, pathname),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.platform.localeCompare(right.platform);
    })
    .map((entry) => entry.platform);
}

function scorePlatformMatch(platform: Platform, hostname: string, pathname: string): number {
  const cookieDomain = getPlatformCookieDomain(platform);
  const homeHost = safeHostname(getPlatformHomeUrl(platform));
  const originHost = safeHostname(getPlatformOrigin(platform));

  let score = 0;
  if (hostname === cookieDomain || hostname.endsWith(`.${cookieDomain}`)) {
    score += 5;
  }
  if (hostname === homeHost || hostname.endsWith(`.${homeHost}`)) {
    score += 3;
  }
  if (hostname === originHost || hostname.endsWith(`.${originHost}`)) {
    score += 2;
  }

  if (platform === "confluence" && pathname.startsWith("/wiki")) {
    score += 4;
  }
  if (platform === "jira" && (pathname.startsWith("/browse/") || pathname.startsWith("/rest/api/") || pathname.startsWith("/jira/"))) {
    score += 4;
  }
  if (platform === "youtube-music" && hostname.startsWith("music.")) {
    score += 4;
  }

  return score;
}

function safeHostname(input: string): string {
  return new URL(input).hostname.replace(/^\./u, "").toLowerCase();
}

function safePathname(input: string): string {
  try {
    return new URL(input).pathname;
  } catch {
    return "";
  }
}

function getSessionBaseUrl(platform: Platform, session?: PlatformSession): string {
  const siteUrl = session?.metadata && typeof session.metadata.siteUrl === "string"
    ? session.metadata.siteUrl
    : undefined;
  if (siteUrl) {
    return ensureTrailingSlash(siteUrl);
  }

  return ensureTrailingSlash(getPlatformHomeUrl(platform));
}

export function buildRequestUrl(pathOrUrl: string, baseUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    throw new AutoCliError("TOOLS_HTTP_REQUEST_PATH_REQUIRED", "Provide a request path or full URL.");
  }

  if (/^https?:\/\//u.test(trimmed)) {
    return normalizePublicHttpUrl(trimmed);
  }

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return new URL(normalizedPath, ensureTrailingSlash(baseUrl)).toString();
}

function parseRequestBody(body: string | undefined, jsonBody: string | undefined): RequestBody {
  if (body && jsonBody) {
    throw new AutoCliError("TOOLS_HTTP_BODY_CONFLICT", "Use either --body or --json-body, not both.");
  }

  if (jsonBody) {
    try {
      JSON.parse(jsonBody);
    } catch (error) {
      throw new AutoCliError("TOOLS_HTTP_JSON_BODY_INVALID", "The value passed to --json-body is not valid JSON.", {
        cause: error,
      });
    }

    return {
      body: jsonBody,
      contentType: "application/json",
    };
  }

  if (typeof body === "string") {
    return {
      body,
    };
  }

  return {};
}

async function buildRequestHeaders(input: {
  jar: CookieJar;
  requestUrl: string;
  baseUrl: string;
  headerInputs: string[];
  contentType?: string;
}): Promise<Record<string, string>> {
  const baseOrigin = new URL(input.baseUrl).origin;
  const headers: Record<string, string> = {
    accept: "*/*",
    "user-agent": USER_AGENT,
    origin: baseOrigin,
    referer: input.baseUrl,
  };

  if (input.contentType) {
    headers["content-type"] = input.contentType;
  }

  const cookies = await input.jar.getCookies(input.requestUrl);
  const csrfCandidates = new Map<string, string>();
  for (const cookie of cookies) {
    csrfCandidates.set(cookie.key, cookie.value);
  }

  const twitterCsrf = csrfCandidates.get("ct0");
  if (twitterCsrf) {
    headers["x-csrf-token"] = twitterCsrf;
    headers["x-twitter-auth-type"] = "OAuth2Session";
  }

  const csrfToken = csrfCandidates.get("csrftoken");
  if (csrfToken) {
    headers["x-csrftoken"] = csrfToken;
    headers["x-csrf-token"] = csrfToken;
  }

  const xsrfToken = csrfCandidates.get("XSRF-TOKEN") ?? csrfCandidates.get("xsrf-token");
  if (xsrfToken) {
    headers["x-xsrf-token"] = decodeURIComponentSafe(xsrfToken);
  }

  for (const headerInput of input.headerInputs) {
    const separator = headerInput.indexOf(":");
    if (separator < 1) {
      throw new AutoCliError("TOOLS_HTTP_HEADER_INVALID", `Invalid header "${headerInput}". Use "Name: value".`);
    }

    const name = headerInput.slice(0, separator).trim().toLowerCase();
    const value = headerInput.slice(separator + 1).trim();
    if (!name) {
      throw new AutoCliError("TOOLS_HTTP_HEADER_INVALID", `Invalid header "${headerInput}". Use "Name: value".`);
    }
    headers[name] = value;
  }

  return headers;
}

function parseResponseBody(body: string, contentType: string | null): unknown {
  if (!body) {
    return "";
  }

  if (contentType && /\bjson\b/u.test(contentType)) {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  return body;
}

function normalizeHttpMethod(method: string): string {
  const normalized = method.trim().toUpperCase();
  if (!normalized) {
    throw new AutoCliError("TOOLS_HTTP_METHOD_REQUIRED", "Provide an HTTP method like GET or POST.");
  }
  return normalized;
}

function normalizeCaptureGroupBy(value: SessionHttpCaptureInput["groupBy"]): SessionHttpCaptureGroupBy {
  const normalized = value?.trim().toLowerCase() ?? "endpoint";
  if (normalized === "endpoint" || normalized === "full-url" || normalized === "method" || normalized === "status") {
    return normalized;
  }

  throw new AutoCliError(
    "TOOLS_HTTP_CAPTURE_GROUP_INVALID",
    `Unsupported capture group value "${value}". Use endpoint, full-url, method, or status.`,
  );
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function matchesCookiePattern(name: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }

  return name === pattern;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function summarizeCapturedRequests(
  requests: ReadonlyArray<{
    method: string;
    url: string;
    status?: number;
    resourceType?: string;
  }>,
  groupBy: SessionHttpCaptureGroupBy,
): {
  totalRequests: number;
  groups: Array<{
    key: string;
    count: number;
    methods: string[];
    statuses: number[];
    resourceTypes: string[];
    sampleUrl?: string;
  }>;
} {
  const groups = new Map<string, {
    key: string;
    count: number;
    methods: Set<string>;
    statuses: Set<number>;
    resourceTypes: Set<string>;
    sampleUrl?: string;
  }>();

  for (const request of requests) {
    const key = buildCaptureGroupKey(request, groupBy);
    const existing = groups.get(key) ?? {
      key,
      count: 0,
      methods: new Set<string>(),
      statuses: new Set<number>(),
      resourceTypes: new Set<string>(),
      sampleUrl: request.url,
    };

    existing.count += 1;
    if (request.method) {
      existing.methods.add(request.method);
    }
    if (typeof request.status === "number") {
      existing.statuses.add(request.status);
    }
    if (request.resourceType) {
      existing.resourceTypes.add(request.resourceType);
    }
    if (!existing.sampleUrl) {
      existing.sampleUrl = request.url;
    }

    groups.set(key, existing);
  }

  return {
    totalRequests: requests.length,
    groups: [...groups.values()]
      .map((group) => ({
        key: group.key,
        count: group.count,
        methods: [...group.methods].sort((left, right) => left.localeCompare(right)),
        statuses: [...group.statuses].sort((left, right) => left - right),
        resourceTypes: [...group.resourceTypes].sort((left, right) => left.localeCompare(right)),
        sampleUrl: group.sampleUrl,
      }))
      .sort((left, right) => {
        if (left.count !== right.count) {
          return right.count - left.count;
        }
        return left.key.localeCompare(right.key);
      }),
  };
}

function buildCaptureGroupKey(
  request: {
    method: string;
    url: string;
    status?: number;
  },
  groupBy: SessionHttpCaptureGroupBy,
): string {
  switch (groupBy) {
    case "full-url":
      return request.url;
    case "method":
      return request.method || "UNKNOWN";
    case "status":
      return typeof request.status === "number" ? String(request.status) : "unknown";
    case "endpoint":
    default:
      return normalizeEndpointKey(request.url);
  }
}

function normalizeEndpointKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

import { createHash } from "node:crypto";

import { AutoCliError, isAutoCliError } from "../errors.js";
import { parseYouTubeTarget } from "../utils/targets.js";
import { BasePlatformAdapter } from "./base.js";
import { Cookie, CookieJar } from "tough-cookie";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  TextPostInput,
} from "../types.js";

const YOUTUBE_ORIGIN = "https://www.youtube.com";
const YOUTUBE_HOME = `${YOUTUBE_ORIGIN}/`;
const YOUTUBE_WATCH = `${YOUTUBE_ORIGIN}/watch?v=`;
const YOUTUBE_CLIENT_NAME = "WEB";
const YOUTUBE_CLIENT_NAME_ID = "1";
const YOUTUBE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const YOUTUBE_COOKIE_ALLOWLIST = new Set([
  "APISID",
  "CONSENT",
  "GPS",
  "HSID",
  "LOGIN_INFO",
  "PREF",
  "SAPISID",
  "SID",
  "SIDCC",
  "SSID",
  "VISITOR_INFO1_LIVE",
  "YSC",
  "__Secure-1PAPISID",
  "__Secure-1PSID",
  "__Secure-1PSIDCC",
  "__Secure-1PSIDTS",
  "__Secure-3PAPISID",
  "__Secure-3PSID",
  "__Secure-3PSIDCC",
  "__Secure-3PSIDTS",
]);

interface YouTubeProbe {
  status: SessionStatus;
  metadata?: Record<string, unknown>;
}

interface YouTubePageConfig {
  apiKey?: string;
  clientVersion?: string;
  visitorData?: string;
  delegatedSessionId?: string;
  sessionIndex?: string;
  createCommentParams?: string;
  loggedIn?: boolean;
}

export class YouTubeAdapter extends BasePlatformAdapter {
  readonly platform = "youtube" as const;
  readonly displayName = "YouTube";

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const probe = await this.inspectCookieJar(imported.jar);
    const account = input.account ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "YouTube session has expired.", {
        details: {
          platform: this.platform,
          account,
          sessionPath,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message:
        probe.status.state === "active"
          ? `Saved YouTube session for ${account}.`
          : `Saved YouTube session for ${account}, but it should be revalidated before heavy use.`,
      sessionPath,
      data: {
        status: probe.status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);
    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: probe.status,
      user: session.user,
    });
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "YouTube uploads are not implemented yet. The current CLI only supports session-based likes and comments for YouTube.",
    );
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "YouTube text posting is not implemented yet. The current CLI only supports session-based likes and comments for YouTube.",
    );
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.loadSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const client = await this.createYouTubeClient(session);
    const watchUrl = target.url ?? `${YOUTUBE_WATCH}${target.videoId}`;
    const page = await this.loadWatchPageContext(client, target.videoId);
    const apiKey = this.requirePageField(page.apiKey, "YouTube API key");
    const clientVersion = this.requirePageField(page.clientVersion, "YouTube client version");

    try {
      await client.request(this.buildYoutubeiUrl("like/like", apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildYouTubeApiHeaders(client, {
          clientVersion,
          visitorData: page.visitorData,
          delegatedSessionId: page.delegatedSessionId,
          sessionIndex: page.sessionIndex,
          referer: watchUrl,
        }),
        body: JSON.stringify({
          context: this.buildYouTubeContext({
            clientVersion,
            visitorData: page.visitorData,
            originalUrl: watchUrl,
          }),
          target: {
            videoId: target.videoId,
          },
        }),
      });
    } catch (error) {
      throw this.mapYouTubeWriteError(error, "Failed to like the YouTube video.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `YouTube video liked for ${session.account}.`,
      id: target.videoId,
      url: watchUrl,
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.loadSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const client = await this.createYouTubeClient(session);
    const watchUrl = target.url ?? `${YOUTUBE_WATCH}${target.videoId}`;
    const page = await this.loadWatchPageContext(client, target.videoId);
    const apiKey = this.requirePageField(page.apiKey, "YouTube API key");
    const clientVersion = this.requirePageField(page.clientVersion, "YouTube client version");
    const createCommentParams = this.requirePageField(
      page.createCommentParams,
      "YouTube createCommentParams token",
      "YouTube did not expose a comment token for this video. Comments may be disabled, or the page needs a fresh logged-in cookie export.",
    );

    try {
      await client.request(this.buildYoutubeiUrl("comment/create_comment", apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildYouTubeApiHeaders(client, {
          clientVersion,
          visitorData: page.visitorData,
          delegatedSessionId: page.delegatedSessionId,
          sessionIndex: page.sessionIndex,
          referer: watchUrl,
        }),
        body: JSON.stringify({
          context: this.buildYouTubeContext({
            clientVersion,
            visitorData: page.visitorData,
            originalUrl: watchUrl,
          }),
          createCommentParams,
          commentText: input.text,
        }),
      });
    } catch (error) {
      throw this.mapYouTubeWriteError(error, "Failed to comment on the YouTube video.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `YouTube comment sent for ${session.account}.`,
      id: target.videoId,
      url: watchUrl,
      data: {
        text: input.text,
      },
    };
  }

  private async ensureUsableSession(session: PlatformSession): Promise<void> {
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "YouTube session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }
  }

  private async probeSession(session: PlatformSession): Promise<YouTubeProbe> {
    const jar = await this.cookieManager.createJar(session);
    return this.inspectCookieJar(jar);
  }

  private async inspectCookieJar(jar: CookieJar): Promise<YouTubeProbe> {
    const client = await this.createYouTubeClientFromJar(jar);
    const authCookie = await this.getAuthCookieValue(client);
    const loginCookie =
      (await client.getCookieValue("LOGIN_INFO", YOUTUBE_HOME)) ??
      (await client.getCookieValue("SID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("__Secure-3PSID", YOUTUBE_HOME));

    if (!authCookie || !loginCookie) {
      return {
        status: {
          state: "expired",
          message: "Missing required YouTube auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const html = await client.request<string>(YOUTUBE_HOME, {
        responseType: "text",
        expectedStatus: 200,
      });
      const page = this.parseYouTubePageConfig(html);

      if (page.loggedIn === true) {
        return {
          status: {
            state: "active",
            message: "Session validated via the YouTube homepage.",
            lastValidatedAt: new Date().toISOString(),
          },
          metadata: this.toMetadata(page),
        };
      }

      if (page.loggedIn === false) {
        return {
          status: {
            state: "expired",
            message: "YouTube returned a logged-out homepage. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "AUTH_FAILED",
          },
          metadata: this.toMetadata(page),
        };
      }

      return {
        status: {
          state: "unknown",
          message: "YouTube auth cookies are present, but homepage validation was inconclusive.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: this.toMetadata(page),
      };
    } catch (error) {
      return {
        status: {
          state: "unknown",
          message: "YouTube auth cookies are present, but homepage validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: isAutoCliError(error) ? error.details : undefined,
      };
    }
  }

  private async createYouTubeClient(session: PlatformSession) {
    const jar = await this.cookieManager.createJar(session);
    return this.createYouTubeClientFromJar(jar);
  }

  private async createYouTubeClientFromJar(jar: CookieJar) {
    const filteredJar = await this.filterYouTubeCookies(jar);
    return new (await import("../utils/http-client.js")).SessionHttpClient(filteredJar, {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": YOUTUBE_USER_AGENT,
    });
  }

  private async loadWatchPageContext(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
    videoId: string,
  ): Promise<YouTubePageConfig> {
    const html = await client.request<string>(`${YOUTUBE_WATCH}${videoId}`, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        referer: YOUTUBE_HOME,
      },
    });

    const page = this.parseYouTubePageConfig(html);
    if (page.loggedIn === false) {
      throw new AutoCliError("SESSION_EXPIRED", "YouTube returned a logged-out watch page. Re-import cookies.txt.");
    }

    return page;
  }

  private parseYouTubePageConfig(html: string): YouTubePageConfig {
    return {
      apiKey: this.matchQuotedValue(html, /"INNERTUBE_API_KEY":"([^"]+)"/),
      clientVersion: this.matchQuotedValue(html, /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/),
      visitorData: this.matchQuotedValue(html, /"VISITOR_DATA":"([^"]+)"/),
      delegatedSessionId: this.matchQuotedValue(html, /"DELEGATED_SESSION_ID":"([^"]+)"/),
      sessionIndex: this.matchQuotedValue(html, /"SESSION_INDEX":"?([^",}]+)"?/),
      createCommentParams: this.matchQuotedValue(html, /"createCommentParams":"([^"]+)"/),
      loggedIn: this.matchBoolean(html, /"LOGGED_IN":(true|false)/),
    };
  }

  private matchQuotedValue(html: string, pattern: RegExp): string | undefined {
    const match = html.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    try {
      return JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return match[1];
    }
  }

  private matchBoolean(html: string, pattern: RegExp): boolean | undefined {
    const match = html.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    return match[1] === "true";
  }

  private toMetadata(page: YouTubePageConfig): Record<string, unknown> {
    return {
      ...(page.apiKey ? { apiKey: page.apiKey } : {}),
      ...(page.clientVersion ? { clientVersion: page.clientVersion } : {}),
      ...(page.visitorData ? { visitorData: page.visitorData } : {}),
      ...(page.delegatedSessionId ? { delegatedSessionId: page.delegatedSessionId } : {}),
      ...(page.sessionIndex ? { sessionIndex: page.sessionIndex } : {}),
    };
  }

  private requirePageField<T extends string>(
    value: T | undefined,
    fieldLabel: string,
    message?: string,
  ): T {
    if (!value) {
      throw new AutoCliError("YOUTUBE_PAGE_CONFIG_MISSING", message ?? `Missing ${fieldLabel} from the YouTube page.`);
    }

    return value;
  }

  private buildYoutubeiUrl(path: string, apiKey: string): string {
    return `${YOUTUBE_ORIGIN}/youtubei/v1/${path}?prettyPrint=false&key=${encodeURIComponent(apiKey)}`;
  }

  private async buildYouTubeApiHeaders(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
    input: {
      clientVersion: string;
      visitorData?: string;
      delegatedSessionId?: string;
      sessionIndex?: string;
      referer: string;
    },
  ): Promise<Record<string, string>> {
    const sapisid = await this.getAuthCookieValue(client);
    if (!sapisid) {
      throw new AutoCliError("SESSION_EXPIRED", "YouTube SAPISID cookie is missing. Re-import cookies.txt.");
    }

    return {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: buildSapisidHash(sapisid, YOUTUBE_ORIGIN),
      "content-type": "application/json",
      origin: YOUTUBE_ORIGIN,
      referer: input.referer,
      "user-agent": YOUTUBE_USER_AGENT,
      "x-goog-authuser": input.sessionIndex ?? "0",
      ...(input.delegatedSessionId ? { "x-goog-pageid": input.delegatedSessionId } : {}),
      ...(input.visitorData ? { "x-goog-visitor-id": input.visitorData } : {}),
      "x-origin": YOUTUBE_ORIGIN,
      "x-youtube-bootstrap-logged-in": "true",
      "x-youtube-client-name": YOUTUBE_CLIENT_NAME_ID,
      "x-youtube-client-version": input.clientVersion,
    };
  }

  private buildYouTubeContext(input: {
    clientVersion: string;
    visitorData?: string;
    originalUrl: string;
  }): Record<string, unknown> {
    return {
      client: {
        clientName: YOUTUBE_CLIENT_NAME,
        clientVersion: input.clientVersion,
        hl: "en",
        gl: "US",
        visitorData: input.visitorData,
        userAgent: YOUTUBE_USER_AGENT,
        browserName: "Chrome",
        browserVersion: "136.0.0.0",
        osName: "Macintosh",
        osVersion: "10_15_7",
        platform: "DESKTOP",
        clientFormFactor: "UNKNOWN_FORM_FACTOR",
        originalUrl: input.originalUrl,
      },
      user: {
        lockedSafetyMode: false,
      },
      request: {
        useSsl: true,
      },
    };
  }

  private async getAuthCookieValue(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
  ): Promise<string | undefined> {
    return (
      (await client.getCookieValue("SAPISID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("__Secure-3PAPISID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("APISID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("__Secure-1PAPISID", YOUTUBE_HOME))
    );
  }

  private mapYouTubeWriteError(error: unknown, fallbackMessage: string): AutoCliError {
    if (isAutoCliError(error) && error.code === "HTTP_REQUEST_FAILED") {
      const status = typeof error.details?.status === "number" ? error.details.status : undefined;

      if (status === 400) {
        return new AutoCliError(
          "YOUTUBE_REQUEST_REJECTED",
          "YouTube rejected this action request. The video may not allow this action, or the saved cookies need a fresh export.",
          {
            cause: error,
            details: error.details,
          },
        );
      }

      if (status === 401 || status === 403) {
        return new AutoCliError(
          "SESSION_EXPIRED",
          "YouTube rejected the saved session for this action. Re-export cookies from an active browser session.",
          {
            cause: error,
            details: error.details,
          },
        );
      }
    }

    return new AutoCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details:
        isAutoCliError(error) && error.details
          ? error.details
          : error instanceof Error
            ? { message: error.message }
            : undefined,
    });
  }

  private async persistSessionState(session: PlatformSession, probe: YouTubeProbe): Promise<void> {
    const jar = await this.cookieManager.createJar(session);
    await this.saveSession({
      account: session.account,
      source: session.source,
      user: session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
      jar,
      existingSession: session,
    });
  }

  private async filterYouTubeCookies(sourceJar: CookieJar): Promise<CookieJar> {
    const filteredJar = new CookieJar();
    const cookies = await sourceJar.getCookies(YOUTUBE_HOME);

    for (const cookie of cookies) {
      if (!YOUTUBE_COOKIE_ALLOWLIST.has(cookie.key)) {
        continue;
      }

      const normalized = Cookie.fromJSON(cookie.toJSON());
      if (!normalized) {
        continue;
      }

      await filteredJar.setCookie(normalized, `https://${cookie.domain}${cookie.path || "/"}`, {
        ignoreError: true,
      });
    }

    return filteredJar;
  }
}

function buildSapisidHash(sapisid: string, origin: string): string {
  const timestamp = Math.floor(Date.now() / 1_000);
  const digest = createHash("sha1").update(`${timestamp} ${sapisid} ${origin}`).digest("hex");
  return `SAPISIDHASH ${timestamp}_${digest}`;
}

import { MikaCliError } from "../../../errors.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import { parseTikTokTarget } from "../../../utils/targets.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../../../types.js";

const TIKTOK_ORIGIN = getPlatformOrigin("tiktok");
const TIKTOK_HOME = getPlatformHomeUrl("tiktok");
const TIKTOK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface TikTokProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

export class TikTokAdapter extends BasePlatformAdapter {
  readonly platform = "tiktok" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const provisionalSession = {
      version: 1 as const,
      platform: this.platform,
      account: input.account ?? "default",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: imported.source,
      status: { state: "unknown" as const },
      cookieJar: serializeCookieJar(imported.jar),
    };

    const probe = await this.probeSession(provisionalSession);
    const account = input.account ?? probe.user?.username ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "TikTok session has expired.", {
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
          ? `Saved TikTok session for ${account}.`
          : `Saved TikTok session for ${account}, but homepage validation was partial.`,
      user: probe.user,
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
      user: probe.user ?? session.user,
    });
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    await this.ensureSavedSession(input.account);
    throw this.createWriteSigningError("post", {
      mediaPath: input.mediaPath,
      hasCaption: Boolean(input.caption),
    });
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    await this.ensureSavedSession(input.account);
    throw new MikaCliError(
      "UNSUPPORTED_ACTION",
      "TikTok web sessions do not support a text-only post in this CLI. Use `mikacli social tiktok post <media-path> --caption ...` once TikTok request signing support is added.",
      {
        details: {
          platform: this.platform,
          account: input.account,
        },
      },
    );
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseTikTokTarget(input.target);
    throw this.createWriteSigningError("like", {
      account: session.account,
      itemId: target.itemId,
      target: input.target,
    });
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseTikTokTarget(input.target);
    throw this.createWriteSigningError("comment", {
      account: session.account,
      itemId: target.itemId,
      target: input.target,
    });
  }

  private async ensureSavedSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    const probe = await this.probeSession(loaded.session);
    await this.persistSessionState(loaded.session, probe);

    if (probe.status.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "TikTok session has expired.", {
        details: {
          platform: this.platform,
          account: loaded.session.account,
          sessionPath: loaded.path,
        },
      });
    }

    return loaded;
  }

  private async probeSession(session: PlatformSession): Promise<TikTokProbe> {
    const client = await this.createTikTokClient(session);
    const sessionCookie = await this.getFirstCookieValue(client, ["sid_tt", "sessionid", "sessionid_ss"], TIKTOK_HOME);
    const userId = await this.getFirstCookieValue(client, ["uid_tt", "uid_tt_ss"], TIKTOK_HOME);

    if (!sessionCookie) {
      return {
        status: {
          state: "expired",
          message: "Missing required TikTok auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const homeHtml = await client.request<string>(TIKTOK_HOME, {
        responseType: "text",
        expectedStatus: 200,
        headers: {
          "user-agent": TIKTOK_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      const state = this.extractStatePayload(homeHtml);
      const loggedIn = this.extractLoginFlag(state, homeHtml);
      const user = this.extractUser(state, homeHtml, userId);

      if (loggedIn === false) {
        return {
          status: {
            state: "expired",
            message: "TikTok returned a logged-out homepage. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "LOGGED_OUT",
          },
          user,
        };
      }

      return {
        status: {
          state: loggedIn === true ? "active" : "unknown",
          message:
            loggedIn === true
              ? "Session validated via the TikTok homepage."
              : "TikTok auth cookies are present, but homepage validation was inconclusive.",
          lastValidatedAt: new Date().toISOString(),
        },
        user,
        metadata: {
          userId,
          validation: loggedIn === true ? "homepage" : "cookie_only",
        },
      };
    } catch {
      return {
        status: {
          state: "unknown",
          message: "TikTok auth cookies are present, but homepage validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: userId ? { id: userId } : undefined,
        metadata: {
          userId,
          validation: "unavailable",
        },
      };
    }
  }

  private async createTikTokClient(session: PlatformSession) {
    return this.createClient(session, {
      origin: TIKTOK_ORIGIN,
      referer: TIKTOK_HOME,
      "user-agent": TIKTOK_USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    });
  }

  private async persistSessionState(session: PlatformSession, probe: TikTokProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async getFirstCookieValue(
    client: Awaited<ReturnType<TikTokAdapter["createTikTokClient"]>>,
    names: string[],
    url: string,
  ): Promise<string | undefined> {
    for (const name of names) {
      const value = await client.getCookieValue(name, url);
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private extractStatePayload(html: string): unknown {
    const patterns = [
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/u,
      /<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/u,
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/u,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match?.[1]) {
        continue;
      }

      try {
        return JSON.parse(match[1]);
      } catch {
        continue;
      }
    }

    return undefined;
  }

  private extractLoginFlag(state: unknown, html: string): boolean | undefined {
    const fromState = this.findBooleanField(state, ["isLogin", "is_login", "loggedIn", "isLoggedIn"]);
    if (typeof fromState === "boolean") {
      return fromState;
    }

    if (/"isLogin":true|"is_login":true|"loggedIn":true|"isLoggedIn":true/u.test(html)) {
      return true;
    }

    if (/"isLogin":false|"is_login":false|"loggedIn":false|"isLoggedIn":false/u.test(html)) {
      return false;
    }

    return undefined;
  }

  private extractUser(state: unknown, html: string, fallbackId?: string): SessionUser | undefined {
    const candidate = this.findObject(state, (value) => {
      return (
        typeof value.uniqueId === "string" &&
        value.uniqueId.length > 0 &&
        (typeof value.nickname === "string" ||
          typeof value.id === "string" ||
          typeof value.id === "number" ||
          typeof value.userId === "string" ||
          typeof value.userId === "number")
      );
    });

    if (candidate) {
      const username = typeof candidate.uniqueId === "string" ? candidate.uniqueId : undefined;
      const displayName = typeof candidate.nickname === "string" ? candidate.nickname : undefined;
      const idValue =
        typeof candidate.id === "string" || typeof candidate.id === "number"
          ? candidate.id
          : typeof candidate.userId === "string" || typeof candidate.userId === "number"
            ? candidate.userId
            : fallbackId;

      if (username || displayName || idValue) {
        return {
          id: idValue ? String(idValue) : undefined,
          username,
          displayName,
          profileUrl: username ? `${TIKTOK_ORIGIN}/@${username}` : undefined,
        };
      }
    }

    const username = this.extractFirst(html, /"uniqueId":"([^"]+)"/u);
    const displayName = this.extractFirst(html, /"nickname":"([^"]+)"/u);
    if (username || displayName || fallbackId) {
      return {
        id: fallbackId,
        username: username ?? undefined,
        displayName: displayName ?? undefined,
        profileUrl: username ? `${TIKTOK_ORIGIN}/@${username}` : undefined,
      };
    }

    return undefined;
  }

  private findBooleanField(root: unknown, fieldNames: string[]): boolean | undefined {
    const queue: unknown[] = [root];
    let inspected = 0;

    while (queue.length > 0 && inspected < 5000) {
      const current = queue.shift();
      inspected += 1;

      if (!current || typeof current !== "object") {
        continue;
      }

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      const object = current as Record<string, unknown>;
      for (const fieldName of fieldNames) {
        if (typeof object[fieldName] === "boolean") {
          return object[fieldName] as boolean;
        }
      }

      queue.push(...Object.values(object));
    }

    return undefined;
  }

  private findObject(
    root: unknown,
    predicate: (value: Record<string, unknown>) => boolean,
  ): Record<string, unknown> | undefined {
    const queue: unknown[] = [root];
    let inspected = 0;

    while (queue.length > 0 && inspected < 5000) {
      const current = queue.shift();
      inspected += 1;

      if (!current || typeof current !== "object") {
        continue;
      }

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      const object = current as Record<string, unknown>;
      if (predicate(object)) {
        return object;
      }

      queue.push(...Object.values(object));
    }

    return undefined;
  }

  private extractFirst(input: string, pattern: RegExp): string | undefined {
    return input.match(pattern)?.[1];
  }

  private createWriteSigningError(action: "post" | "like" | "comment", details?: Record<string, unknown>): MikaCliError {
    return new MikaCliError(
      "TIKTOK_SIGNING_REQUIRED",
      `TikTok ${action} is not enabled yet. TikTok web write actions currently require request signing and anti-bot parameters that are not implemented in this adapter yet.`,
      {
        details: {
          platform: this.platform,
          action,
          ...details,
        },
      },
    );
  }
}

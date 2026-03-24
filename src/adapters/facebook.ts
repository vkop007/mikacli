import { AutoCliError } from "../errors.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../platforms.js";
import { serializeCookieJar } from "../utils/cookie-manager.js";
import { parseFacebookTarget } from "../utils/targets.js";
import { BasePlatformAdapter } from "./base.js";

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
} from "../types.js";

const FACEBOOK_ORIGIN = getPlatformOrigin("facebook");
const FACEBOOK_HOME = getPlatformHomeUrl("facebook");
const FACEBOOK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface FacebookProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

export class FacebookAdapter extends BasePlatformAdapter {
  readonly platform = "facebook" as const;

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
    const account = input.account ?? probe.user?.username ?? probe.user?.id ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Facebook session has expired.", {
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
          ? `Saved Facebook session for ${account}.`
          : `Saved Facebook session for ${account}, but homepage validation was partial.`,
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
    const { session } = await this.ensureSavedSession(input.account);
    throw this.createPostApiError(session.account, {
      mediaPath: input.mediaPath,
      hasCaption: Boolean(input.caption),
    });
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    throw this.createPostApiError(session.account, {
      hasImage: Boolean(input.imagePath),
      textLength: input.text.length,
    });
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseFacebookTarget(input.target);
    throw new AutoCliError(
      "FACEBOOK_WEB_WRITE_NOT_IMPLEMENTED",
      "Facebook like is not implemented yet. The current adapter validates sessions only; Facebook web write flows need a dedicated request-tracing pass.",
      {
        details: {
          platform: this.platform,
          account: session.account,
          objectId: target.objectId,
          target: input.target,
        },
      },
    );
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseFacebookTarget(input.target);
    throw new AutoCliError(
      "FACEBOOK_WEB_WRITE_NOT_IMPLEMENTED",
      "Facebook comment is not implemented yet. The current adapter validates sessions only; Facebook web write flows need a dedicated request-tracing pass.",
      {
        details: {
          platform: this.platform,
          account: session.account,
          objectId: target.objectId,
          target: input.target,
        },
      },
    );
  }

  private async ensureSavedSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    const probe = await this.probeSession(loaded.session);
    await this.persistSessionState(loaded.session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Facebook session has expired.", {
        details: {
          platform: this.platform,
          account: loaded.session.account,
          sessionPath: loaded.path,
        },
      });
    }

    return loaded;
  }

  private async probeSession(session: PlatformSession): Promise<FacebookProbe> {
    const client = await this.createFacebookClient(session);
    const cUser = await client.getCookieValue("c_user", FACEBOOK_HOME);
    const xs = await client.getCookieValue("xs", FACEBOOK_HOME);

    if (!cUser || !xs) {
      return {
        status: {
          state: "expired",
          message: "Missing required Facebook auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const html = await client.request<string>(FACEBOOK_HOME, {
        responseType: "text",
        expectedStatus: 200,
        headers: {
          "user-agent": FACEBOOK_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      if (this.looksLoggedOut(html)) {
        return {
          status: {
            state: "expired",
            message: "Facebook returned a logged-out homepage. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "LOGGED_OUT",
          },
        };
      }

      const user = this.extractUser(cUser, html);
      return {
        status: {
          state: "active",
          message: "Session validated via the Facebook homepage.",
          lastValidatedAt: new Date().toISOString(),
        },
        user,
        metadata: this.extractMetadata(cUser, html),
      };
    } catch {
      return {
        status: {
          state: "unknown",
          message: "Facebook auth cookies are present, but homepage validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: {
          id: cUser,
        },
      };
    }
  }

  private async createFacebookClient(session: PlatformSession) {
    return this.createClient(session, {
      origin: FACEBOOK_ORIGIN,
      referer: FACEBOOK_HOME,
      "user-agent": FACEBOOK_USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    });
  }

  private async persistSessionState(session: PlatformSession, probe: FacebookProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private looksLoggedOut(html: string): boolean {
    return (
      html.includes('name="login"') ||
      html.includes('id="login_form"') ||
      html.includes('Create new account') ||
      html.includes('Forgot password?') ||
      html.includes('/login/?next=')
    );
  }

  private extractUser(cUser: string, html: string): SessionUser {
    const username =
      this.extractFirst(html, /"vanity":"([^"]+)"/u) ??
      this.extractFirst(html, /"username":"([^"]+)"/u) ??
      undefined;
    const displayName =
      this.extractFirst(html, /"NAME":"([^"]+)"/u) ??
      this.extractFirst(html, /"short_name":"([^"]+)"/u) ??
      undefined;

    return {
      id: cUser,
      username,
      displayName,
      profileUrl: username ? `${FACEBOOK_ORIGIN}/${username}` : undefined,
    };
  }

  private extractMetadata(cUser: string, html: string): Record<string, unknown> {
    const fbDtsg =
      this.extractFirst(html, /DTSGInitData[\s\S]*?"token":"([^"]+)"/u) ??
      this.extractFirst(html, /name="fb_dtsg" value="([^"]+)"/u);
    const lsd =
      this.extractFirst(html, /"LSD"[\s\S]*?"token":"([^"]+)"/u) ??
      this.extractFirst(html, /name="lsd" value="([^"]+)"/u);

    return {
      actorId: cUser,
      ...(fbDtsg ? { fbDtsg } : {}),
      ...(lsd ? { lsd } : {}),
    };
  }

  private extractFirst(input: string, pattern: RegExp): string | undefined {
    return input.match(pattern)?.[1];
  }

  private createPostApiError(account: string, details?: Record<string, unknown>): AutoCliError {
    return new AutoCliError(
      "FACEBOOK_PAGE_API_REQUIRED",
      "Facebook posting is not enabled in the cookie-session adapter. For reliable posting, use the official Facebook Pages API with page access tokens.",
      {
        details: {
          platform: this.platform,
          account,
          ...details,
        },
      },
    );
  }
}

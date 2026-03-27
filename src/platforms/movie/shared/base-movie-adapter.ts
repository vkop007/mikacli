import { AutoCliError } from "../../../errors.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
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

export interface MovieSessionProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

export abstract class BaseMovieAdapter extends BasePlatformAdapter {
  abstract override readonly platform: "imdb" | "myanimelist";

  abstract readonly targetLabel: string;

  protected abstract probeSession(session: PlatformSession): Promise<MovieSessionProbe>;

  abstract search(input: { query: string; limit?: number; account?: string }): Promise<AdapterActionResult>;
  abstract titleInfo(input: { target: string; account?: string }): Promise<AdapterActionResult>;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const provisionalSession: PlatformSession = {
      version: 1,
      platform: this.platform,
      account: input.account ?? "default",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: imported.source,
      status: { state: "unknown" },
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
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? `${this.displayName} session has expired.`, {
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
          ? `Saved ${this.displayName} session for ${account}.`
          : `Saved ${this.displayName} session for ${account}, but validation is limited.`,
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

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: `${this.displayName} session is ${status.status}.`,
      user: status.user,
      sessionPath: status.sessionPath,
      data: {
        connected: status.connected,
        status: status.status,
        details: status.message,
        lastValidatedAt: status.lastValidatedAt,
      },
    };
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw this.createUnsupportedWriteError("postMedia");
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw this.createUnsupportedWriteError("postText");
  }

  async like(_input: LikeInput): Promise<AdapterActionResult> {
    throw this.createUnsupportedWriteError("like");
  }

  async comment(_input: CommentInput): Promise<AdapterActionResult> {
    throw this.createUnsupportedWriteError("comment");
  }

  protected async ensureAvailableSession(account?: string): Promise<{ session: PlatformSession; path: string; probe: MovieSessionProbe }> {
    const loaded = await this.loadSession(account);
    const probe = await this.probeSession(loaded.session);
    await this.persistSessionState(loaded.session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? `${this.displayName} session has expired.`, {
        details: {
          platform: this.platform,
          account: loaded.session.account,
          sessionPath: loaded.path,
        },
      });
    }

    return {
      session: loaded.session,
      path: loaded.path,
      probe,
    };
  }

  protected async persistSessionState(session: PlatformSession, probe: MovieSessionProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  protected createUnsupportedWriteError(action: string): AutoCliError {
    return new AutoCliError(
      "UNSUPPORTED_ACTION",
      `${this.displayName} is currently implemented for session import, status, search, and title lookups only.`,
      {
        details: {
          platform: this.platform,
          action,
        },
      },
    );
  }
}

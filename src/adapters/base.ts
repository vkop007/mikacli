import { CookieManager, createSessionFile, serializeCookieJar } from "../utils/cookie-manager.js";
import { SessionHttpClient } from "../utils/http-client.js";
import { getPlatformDisplayName } from "../platforms.js";
import type { AdapterStatusResult, Platform, PlatformAdapter, PlatformSession, SessionStatus, SessionUser } from "../types.js";

export abstract class BasePlatformAdapter implements PlatformAdapter {
  readonly cookieManager = new CookieManager();

  abstract readonly platform: Platform;

  get displayName(): string {
    return getPlatformDisplayName(this.platform);
  }

  abstract login(input: Parameters<PlatformAdapter["login"]>[0]): ReturnType<PlatformAdapter["login"]>;
  abstract getStatus(account?: string): ReturnType<PlatformAdapter["getStatus"]>;
  abstract postMedia(input: Parameters<PlatformAdapter["postMedia"]>[0]): ReturnType<PlatformAdapter["postMedia"]>;
  abstract postText(input: Parameters<PlatformAdapter["postText"]>[0]): ReturnType<PlatformAdapter["postText"]>;
  abstract like(input: Parameters<PlatformAdapter["like"]>[0]): ReturnType<PlatformAdapter["like"]>;
  abstract comment(input: Parameters<PlatformAdapter["comment"]>[0]): ReturnType<PlatformAdapter["comment"]>;

  protected async loadSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    return this.cookieManager.loadSession(this.platform, account);
  }

  protected async createClient(session: PlatformSession, headers: Record<string, string> = {}): Promise<SessionHttpClient> {
    const jar = await this.cookieManager.createJar(session);
    return new SessionHttpClient(jar, headers);
  }

  protected async saveSession(input: {
    account: string;
    source: PlatformSession["source"];
    user?: SessionUser;
    status?: SessionStatus;
    metadata?: Record<string, unknown>;
    jar: Awaited<ReturnType<CookieManager["createJar"]>>;
    existingSession?: PlatformSession;
  }): Promise<string> {
    const serializedJar = serializeCookieJar(input.jar);
    const session = createSessionFile({
      platform: this.platform,
      account: input.account,
      source: input.source,
      user: input.user,
      status: input.status,
      metadata: input.metadata,
      cookieJar: serializedJar,
      existingSession: input.existingSession,
    });

    return this.cookieManager.saveSession(session);
  }

  protected async persistExistingSession(
    session: PlatformSession,
    input: {
      jar?: Awaited<ReturnType<CookieManager["createJar"]>>;
      user?: SessionUser;
      status?: SessionStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PlatformSession> {
    const jar = input.jar ?? (await this.cookieManager.createJar(session));
    const nextSession = createSessionFile({
      platform: this.platform,
      account: session.account,
      source: session.source,
      user: input.user ?? session.user,
      status: input.status ?? session.status,
      metadata: input.metadata ?? session.metadata,
      cookieJar: serializeCookieJar(jar),
      existingSession: session,
    });

    await this.cookieManager.saveSession(nextSession);
    return nextSession;
  }

  protected buildStatusResult(input: {
    account: string;
    sessionPath: string;
    status: SessionStatus;
    user?: SessionUser;
  }): AdapterStatusResult {
    return {
      platform: this.platform,
      account: input.account,
      sessionPath: input.sessionPath,
      connected: input.status.state === "active",
      status: input.status.state,
      message: input.status.message,
      user: input.user,
      lastValidatedAt: input.status.lastValidatedAt,
    };
  }
}

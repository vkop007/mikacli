import { sanitizeAccountName } from "../../../config.js";
import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { AutoCliError } from "../../../errors.js";
import { emitInteractiveProgress } from "../../../utils/interactive-progress.js";
import { getPlatformDisplayName } from "../../config.js";
import { buildGoogleAuthUrl, GOOGLE_OPENID_SCOPES, GoogleOAuthClient, type GoogleUserProfile } from "./oauth.js";
import { startGoogleLoopbackAuthorization } from "./loopback.js";

import type { ConnectionRecord, OAuth2ConnectionAuth } from "../../../core/auth/auth-types.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";

export interface GoogleLoginInput {
  account?: string;
  clientId?: string;
  clientSecret?: string;
  code?: string;
  redirectUri?: string;
  refreshToken?: string;
  scopes?: string[];
  timeoutSeconds?: number;
  loginHint?: string;
}

export interface GoogleAuthUrlActionInput {
  clientId?: string;
  redirectUri?: string;
  scopes?: string[];
  state?: string;
  loginHint?: string;
}

export type LoadedGoogleConnection = {
  account: string;
  path: string;
  auth: OAuth2ConnectionAuth;
  connection: ConnectionRecord;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
};

export type ActiveGoogleConnection = LoadedGoogleConnection & {
  accessToken: string;
  profile: GoogleUserProfile;
  scopes: string[];
};

type OAuth2ConnectionStore = Pick<ConnectionStore, "saveOAuth2Connection" | "loadOAuth2Connection">;

export abstract class BaseGooglePlatformAdapter {
  protected readonly connectionStore: OAuth2ConnectionStore;
  protected readonly fetchImpl: typeof fetch;

  abstract readonly platform: Platform;
  protected abstract readonly defaultScopes: readonly string[];

  constructor(input: { fetchImpl?: typeof fetch; connectionStore?: OAuth2ConnectionStore } = {}) {
    this.fetchImpl = input.fetchImpl ?? fetch;
    this.connectionStore = input.connectionStore ?? new ConnectionStore();
  }

  get displayName(): string {
    return getPlatformDisplayName(this.platform);
  }

  async authUrl(input: GoogleAuthUrlActionInput): Promise<AdapterActionResult> {
    const clientId = input.clientId?.trim();
    const redirectUri = input.redirectUri?.trim();
    if (!clientId) {
      throw new AutoCliError("GOOGLE_CLIENT_ID_REQUIRED", `${this.displayName} auth-url requires --client-id.`);
    }
    if (!redirectUri) {
      throw new AutoCliError("GOOGLE_REDIRECT_URI_REQUIRED", `${this.displayName} auth-url requires --redirect-uri.`);
    }

    const scopes = this.resolveScopes(input.scopes);
    const authUrl = buildGoogleAuthUrl({
      clientId,
      redirectUri,
      scopes,
      state: input.state,
      loginHint: input.loginHint,
    });

    return this.buildActionResult({
      account: "oauth2",
      action: "auth-url",
      message: `Generated Google OAuth consent URL for ${this.displayName}.`,
      url: authUrl,
      data: {
        authUrl,
        redirectUri,
        scopes,
      },
    });
  }

  async login(input: GoogleLoginInput): Promise<AdapterActionResult> {
    const clientId = input.clientId?.trim();
    const clientSecret = input.clientSecret?.trim();
    let code = input.code?.trim();
    const refreshToken = input.refreshToken?.trim();
    let redirectUri = input.redirectUri?.trim();
    const scopes = this.resolveScopes(input.scopes);

    if (!clientId) {
      throw new AutoCliError("GOOGLE_CLIENT_ID_REQUIRED", `${this.displayName} login requires --client-id.`);
    }
    if (!clientSecret) {
      throw new AutoCliError("GOOGLE_CLIENT_SECRET_REQUIRED", `${this.displayName} login requires --client-secret.`);
    }
    if (code && !redirectUri) {
      throw new AutoCliError("GOOGLE_REDIRECT_URI_REQUIRED", `${this.displayName} login with --code also requires --redirect-uri.`);
    }

    let authUrl: string | undefined;
    if (!code && !refreshToken) {
      const loopback = await startGoogleLoopbackAuthorization({
        clientId,
        redirectUri,
        scopes,
        loginHint: input.loginHint,
        timeoutSeconds: input.timeoutSeconds,
        buildAuthUrl: ({ clientId: readyClientId, redirectUri: readyRedirectUri, scopes: readyScopes, state, loginHint }) =>
          buildGoogleAuthUrl({
            clientId: readyClientId,
            redirectUri: readyRedirectUri,
            scopes: readyScopes,
            state,
            loginHint,
          }),
      });
      redirectUri = loopback.redirectUri;
      authUrl = loopback.authUrl;
      announceGoogleLoopbackLogin(this.displayName, authUrl, redirectUri, input.timeoutSeconds);
      try {
        code = await loopback.waitForCode();
      } finally {
        await loopback.close().catch(() => {});
      }
    }

    const oauth = new GoogleOAuthClient({
      clientId,
      clientSecret,
      fetchImpl: this.fetchImpl,
    });

    const tokenSet = code
      ? await oauth.exchangeCode({
          code,
          redirectUri: redirectUri as string,
        })
      : await oauth.refreshAccessToken({
          refreshToken: refreshToken as string,
        });

    const resolvedRefreshToken = tokenSet.refreshToken ?? refreshToken;
    if (!resolvedRefreshToken) {
      throw new AutoCliError(
        "GOOGLE_REFRESH_TOKEN_MISSING",
        "Google did not return a refresh token. Re-run the consent flow with offline access and consent enabled.",
      );
    }

    const profile = await oauth.getUserProfile(tokenSet.accessToken);
    const account = this.resolveAccountName(input.account, [profile.email?.split("@")[0], profile.email, profile.sub]);
    const user = this.toSessionUser(profile);
    const resolvedScopes = tokenSet.scopes.length > 0 ? tokenSet.scopes : scopes;
    const sessionPath = await this.connectionStore.saveOAuth2Connection({
      platform: this.platform,
      account,
      provider: "google",
      clientId,
      clientSecret,
      refreshToken: resolvedRefreshToken,
      accessToken: tokenSet.accessToken,
      expiresAt: tokenSet.expiresAt,
      tokenType: tokenSet.tokenType,
      scopes: resolvedScopes,
      user,
      status: this.activeStatus("Google OAuth connection validated."),
      metadata: {
        profile: summarizeGoogleProfile(profile),
        redirectUri,
        scopes: resolvedScopes,
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved ${this.displayName} Google OAuth connection for ${account}.`,
      sessionPath,
      user,
      data: {
        profile: summarizeGoogleProfile(profile),
        scopes: resolvedScopes,
        status: "active",
        ...(authUrl ? { authUrl, redirectUri } : {}),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadOAuthConnection(account);

    try {
      const active = await this.ensureActiveConnectionFromLoaded(loaded);
      return this.buildStatusResult({
        account: active.account,
        sessionPath: active.path,
        status: active.connection.status,
        user: active.user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${this.displayName} OAuth validation failed.`;
      const status = this.expiredStatus(message, "GOOGLE_OAUTH_ERROR");
      const sessionPath = await this.persistOAuthConnection(loaded, {
        status,
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user: loaded.user,
      });
    }
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    return this.buildStatusAction(await this.getStatus(account));
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(account);
    return this.buildActionResult({
      account: active.account,
      action: "me",
      message: `Loaded ${this.displayName} Google profile.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        profile: summarizeGoogleProfile(active.profile),
        scopes: active.scopes,
      },
    });
  }

  protected async ensureActiveConnection(account?: string): Promise<ActiveGoogleConnection> {
    const loaded = await this.loadOAuthConnection(account);
    return this.ensureActiveConnectionFromLoaded(loaded);
  }

  protected resolveScopes(scopes?: readonly string[]): string[] {
    const requested = scopes && scopes.length > 0 ? scopes : this.defaultScopes;
    return uniqueStrings([...GOOGLE_OPENID_SCOPES, ...requested]);
  }

  protected summarizeProfile(profile: GoogleUserProfile): Record<string, unknown> {
    return summarizeGoogleProfile(profile);
  }

  protected activeStatus(message: string): SessionStatus {
    return {
      state: "active",
      message,
      lastValidatedAt: new Date().toISOString(),
    };
  }

  protected expiredStatus(message: string, code?: string): SessionStatus {
    return {
      state: "expired",
      message,
      lastValidatedAt: new Date().toISOString(),
      ...(code ? { lastErrorCode: code } : {}),
    };
  }

  protected resolveAccountName(inputAccount: string | undefined, candidates: Array<string | undefined>): string {
    const preferred = inputAccount?.trim() || candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    return sanitizeAccountName(preferred || "default");
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

  protected buildStatusAction(input: AdapterStatusResult): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: input.account,
      action: "status",
      message: `${this.displayName} connection is ${input.status}.`,
      user: input.user,
      sessionPath: input.sessionPath,
      data: {
        connected: input.connected,
        status: input.status,
        details: input.message,
        lastValidatedAt: input.lastValidatedAt,
      },
    };
  }

  protected buildActionResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath?: string;
    user?: SessionUser;
    id?: string;
    url?: string;
    data?: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      id: input.id,
      url: input.url,
      data: input.data,
    };
  }

  private async loadOAuthConnection(account?: string): Promise<LoadedGoogleConnection> {
    const loaded = await this.connectionStore.loadOAuth2Connection(this.platform, account);
    return {
      account: loaded.connection.account,
      path: loaded.path,
      auth: loaded.auth,
      connection: loaded.connection,
      user: loaded.connection.user,
      metadata: loaded.connection.metadata,
    };
  }

  private async ensureActiveConnectionFromLoaded(loaded: LoadedGoogleConnection): Promise<ActiveGoogleConnection> {
    const auth = await this.refreshIfNeeded(loaded.auth);
    const accessToken = auth.accessToken?.trim();
    if (!accessToken) {
      throw new AutoCliError("GOOGLE_ACCESS_TOKEN_MISSING", `No usable ${this.displayName} access token is saved. Log in again.`);
    }

    const oauth = new GoogleOAuthClient({
      clientId: auth.clientId ?? "",
      clientSecret: auth.clientSecret,
      fetchImpl: this.fetchImpl,
    });
    const profile = await oauth.getUserProfile(accessToken);
    const user = this.toSessionUser(profile) ?? loaded.user;
    const scopes = auth.scopes ?? loaded.auth.scopes ?? [];
    const status = this.activeStatus("Google OAuth connection validated.");
    const path = await this.persistOAuthConnection(loaded, {
      auth,
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        profile: summarizeGoogleProfile(profile),
        scopes,
      },
    });

    return {
      ...loaded,
      path,
      auth,
      user,
      accessToken,
      profile,
      scopes,
      connection: {
        ...loaded.connection,
        auth,
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          profile: summarizeGoogleProfile(profile),
          scopes,
        },
      },
      metadata: {
        ...(loaded.metadata ?? {}),
        profile: summarizeGoogleProfile(profile),
        scopes,
      },
    };
  }

  private async refreshIfNeeded(auth: OAuth2ConnectionAuth): Promise<OAuth2ConnectionAuth> {
    if (!shouldRefresh(auth)) {
      return auth;
    }

    const clientId = auth.clientId?.trim();
    const clientSecret = auth.clientSecret?.trim();
    const refreshToken = auth.refreshToken?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      throw new AutoCliError(
        "GOOGLE_REFRESH_UNAVAILABLE",
        `The saved ${this.displayName} OAuth connection cannot be refreshed. Log in again with a client id, client secret, and refresh token.`,
      );
    }

    const oauth = new GoogleOAuthClient({
      clientId,
      clientSecret,
      fetchImpl: this.fetchImpl,
    });
    const refreshed = await oauth.refreshAccessToken({ refreshToken });
    return {
      ...auth,
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      tokenType: refreshed.tokenType ?? auth.tokenType,
      scopes: refreshed.scopes.length > 0 ? refreshed.scopes : auth.scopes,
    };
  }

  private async persistOAuthConnection(
    loaded: LoadedGoogleConnection,
    input: {
      auth?: OAuth2ConnectionAuth;
      user?: SessionUser;
      status?: SessionStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    const auth = input.auth ?? loaded.auth;
    return this.connectionStore.saveOAuth2Connection({
      platform: this.platform,
      account: loaded.account,
      provider: auth.provider,
      clientId: auth.clientId,
      clientSecret: auth.clientSecret,
      refreshToken: auth.refreshToken,
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
      tokenType: auth.tokenType,
      scopes: auth.scopes,
      user: input.user ?? loaded.user,
      status: input.status ?? loaded.connection.status,
      metadata: input.metadata ?? loaded.metadata,
    });
  }

  private toSessionUser(profile: GoogleUserProfile): SessionUser | undefined {
    if (!profile.sub && !profile.email && !profile.name) {
      return undefined;
    }

    return {
      id: profile.sub,
      username: profile.email ?? profile.sub,
      displayName: profile.name ?? profile.email ?? profile.sub,
      ...(profile.picture ? { profileUrl: profile.picture } : {}),
    };
  }
}

export function summarizeGoogleProfile(profile: GoogleUserProfile): Record<string, unknown> {
  return {
    id: profile.sub,
    email: profile.email,
    emailVerified: profile.emailVerified,
    displayName: profile.name,
    givenName: profile.givenName,
    familyName: profile.familyName,
    picture: profile.picture,
    hostedDomain: profile.hostedDomain,
  };
}

function shouldRefresh(auth: OAuth2ConnectionAuth): boolean {
  if (!auth.accessToken?.trim()) {
    return true;
  }

  const expiresAt = auth.expiresAt?.trim();
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now() + 60_000;
}

function uniqueStrings(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function announceGoogleLoopbackLogin(
  displayName: string,
  authUrl: string,
  redirectUri: string,
  timeoutSeconds: number | undefined,
): void {
  const timeout = Math.max(1, Math.floor(timeoutSeconds ?? 300));
  const waitingMessage = `Waiting for Google OAuth callback on ${redirectUri}...`;
  if (!emitInteractiveProgress(waitingMessage)) {
    console.error(waitingMessage);
  }

  console.error(`Open this Google consent URL for ${displayName}:`);
  console.error(authUrl);
  console.error(`AutoCLI will wait up to ${timeout} seconds for the browser callback.`);
}

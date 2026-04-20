import { sanitizeAccountName } from "../../../config.js";
import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { MikaCliError } from "../../../errors.js";
import { getPlatformDisplayName } from "../../config.js";

import type { ConnectionRecord } from "../../../core/auth/auth-types.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";

export type LoadedApiKeyConnection = {
  account: string;
  path: string;
  token: string;
  connection: ConnectionRecord;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
};

export abstract class BaseApiKeyPlatformAdapter {
  protected readonly connectionStore = new ConnectionStore();

  abstract readonly platform: Platform;

  get displayName(): string {
    return getPlatformDisplayName(this.platform);
  }

  protected requireToken(token: string | undefined): string {
    const normalized = token?.trim();
    if (!normalized) {
      throw new MikaCliError("API_TOKEN_REQUIRED", `${this.displayName} login requires --token.`);
    }

    return normalized;
  }

  protected resolveAccountName(inputAccount: string | undefined, candidates: Array<string | undefined>): string {
    const preferred = inputAccount?.trim() || candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    return sanitizeAccountName(preferred || "default");
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

  protected async saveTokenConnection(input: {
    account: string;
    token: string;
    provider?: string;
    user?: SessionUser;
    status?: SessionStatus;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    return this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: input.account,
      provider: input.provider,
      token: input.token,
      user: input.user,
      status: input.status,
      metadata: input.metadata,
    });
  }

  protected async loadTokenConnection(account?: string): Promise<LoadedApiKeyConnection> {
    const loaded = await this.connectionStore.loadApiKeyConnection(this.platform, account);
    return {
      account: loaded.connection.account,
      path: loaded.path,
      token: loaded.auth.token,
      connection: loaded.connection,
      user: loaded.connection.user,
      metadata: loaded.connection.metadata,
    };
  }

  protected async persistTokenConnection(
    loaded: LoadedApiKeyConnection,
    input: {
      user?: SessionUser;
      status?: SessionStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    return this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.account,
      token: loaded.token,
      provider: loaded.connection.auth.kind === "apiKey" ? loaded.connection.auth.provider : undefined,
      user: input.user ?? loaded.user,
      status: input.status ?? loaded.connection.status,
      metadata: input.metadata ?? loaded.metadata,
    });
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
}

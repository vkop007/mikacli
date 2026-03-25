import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";

import {
  CONNECTIONS_DIR,
  ensureConnectionDirectory,
  ensureParentDirectory,
  getConnectionPath,
  getPlatformConnectionDir,
  sanitizeAccountName,
} from "../../config.js";
import { AutoCliError } from "../../errors.js";
import { isPlatform } from "../../platforms/config.js";
import { CookieManager } from "../../utils/cookie-manager.js";

import type { Platform, PlatformSession, SessionStatus, SessionUser } from "../../types.js";
import type { BotTokenConnectionAuth, ConnectionRecord } from "./auth-types.js";

const ConnectionRecordSchema = {
  parse(input: unknown): ConnectionRecord {
    if (!input || typeof input !== "object") {
      throw new AutoCliError("INVALID_CONNECTION_FILE", "Connection file is not a valid JSON object.");
    }

    const record = input as Partial<ConnectionRecord>;
    if (
      record.version !== 1 ||
      typeof record.platform !== "string" ||
      !isPlatform(record.platform) ||
      typeof record.account !== "string" ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string" ||
      !record.auth ||
      typeof record.auth !== "object" ||
      typeof record.auth.kind !== "string" ||
      typeof record.status !== "object" ||
      !record.status ||
      typeof record.status.state !== "string"
    ) {
      throw new AutoCliError("INVALID_CONNECTION_FILE", "Connection file is missing required fields.");
    }

    if (record.auth.kind === "botToken" && typeof (record.auth as { token?: unknown }).token !== "string") {
      throw new AutoCliError("INVALID_CONNECTION_FILE", "Bot token connection is missing its token.");
    }

    return record as ConnectionRecord;
  },
};

export class ConnectionStore {
  private readonly cookieManager = new CookieManager();

  async listConnections(): Promise<Array<{ connection: ConnectionRecord; path: string }>> {
    const [storedConnections, sessions] = await Promise.all([this.listStoredConnections(), this.cookieManager.listSessions()]);
    const byKey = new Map<string, { connection: ConnectionRecord; path: string }>();

    for (const entry of storedConnections) {
      byKey.set(this.toKey(entry.connection.platform, entry.connection.account), entry);
    }

    for (const { session, path } of sessions) {
      const connection = this.toConnectionRecord(session);
      const key = this.toKey(connection.platform, connection.account);
      if (!byKey.has(key)) {
        byKey.set(key, { connection, path });
      }
    }

    return Array.from(byKey.values()).sort((left, right) => {
      if (left.connection.platform !== right.connection.platform) {
        return left.connection.platform.localeCompare(right.connection.platform);
      }

      return right.connection.updatedAt.localeCompare(left.connection.updatedAt);
    });
  }

  async loadConnection(platform: Platform, account?: string): Promise<{ connection: ConnectionRecord; path: string }> {
    const resolvedAccount = account ? sanitizeAccountName(account) : undefined;

    try {
      return await this.loadStoredConnection(platform, resolvedAccount);
    } catch (error) {
      if (!(error instanceof AutoCliError) || error.code !== "CONNECTION_NOT_FOUND") {
        throw error;
      }
    }

    const { session, path } = await this.cookieManager.loadSession(platform, account);
    return {
      connection: this.toConnectionRecord(session),
      path,
    };
  }

  async saveConnection(connection: ConnectionRecord): Promise<string> {
    const connectionPath = getConnectionPath(connection.platform, connection.account);
    await ensureParentDirectory(connectionPath);
    await writeFile(connectionPath, `${JSON.stringify(connection, null, 2)}\n`, "utf8");
    return connectionPath;
  }

  async saveBotTokenConnection(input: {
    platform: Platform;
    account: string;
    provider?: string;
    token: string;
    user?: SessionUser;
    status?: SessionStatus;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const now = new Date().toISOString();
    let createdAt = now;

    try {
      const existing = await this.loadStoredConnection(input.platform, input.account);
      createdAt = existing.connection.createdAt;
    } catch (error) {
      if (!(error instanceof AutoCliError) || error.code !== "CONNECTION_NOT_FOUND") {
        throw error;
      }
    }

    return this.saveConnection({
      version: 1,
      platform: input.platform,
      account: sanitizeAccountName(input.account),
      createdAt,
      updatedAt: now,
      auth: {
        kind: "botToken",
        provider: input.provider,
        token: input.token,
      },
      status: input.status ?? {
        state: "unknown",
        message: "Bot token saved.",
        lastValidatedAt: now,
      },
      user: input.user,
      metadata: input.metadata,
    });
  }

  async loadBotTokenConnection(
    platform: Platform,
    account?: string,
  ): Promise<{ connection: ConnectionRecord; path: string; auth: BotTokenConnectionAuth }> {
    const loaded = await this.loadConnection(platform, account);
    if (loaded.connection.auth.kind !== "botToken") {
      throw new AutoCliError(
        "INVALID_CONNECTION_AUTH",
        `The saved ${platform} connection does not use a bot token auth strategy.`,
        {
          details: {
            platform,
            account: loaded.connection.account,
            authKind: loaded.connection.auth.kind,
            connectionPath: loaded.path,
          },
        },
      );
    }

    return {
      ...loaded,
      auth: loaded.connection.auth,
    };
  }

  private toConnectionRecord(session: PlatformSession): ConnectionRecord {
    return {
      version: session.version,
      platform: session.platform,
      account: session.account,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      auth: {
        kind: "cookies",
        source: session.source.kind,
      },
      status: session.status,
      user: session.user,
      metadata: session.metadata,
    };
  }

  private async loadStoredConnection(platform: Platform, account?: string): Promise<{ connection: ConnectionRecord; path: string }> {
    const resolvedAccount = account ? sanitizeAccountName(account) : await this.resolveDefaultStoredAccount(platform);
    const connectionPath = getConnectionPath(platform, resolvedAccount);

    await access(connectionPath, constants.R_OK).catch(() => {
      throw new AutoCliError("CONNECTION_NOT_FOUND", `No saved ${platform} connection found for account "${resolvedAccount}".`, {
        details: { platform, account: resolvedAccount, connectionPath },
      });
    });

    const raw = await readFile(connectionPath, "utf8");
    return {
      connection: ConnectionRecordSchema.parse(JSON.parse(raw)),
      path: connectionPath,
    };
  }

  private async listStoredConnections(): Promise<Array<{ connection: ConnectionRecord; path: string }>> {
    await ensureConnectionDirectory();
    const platforms = await readdir(CONNECTIONS_DIR, { withFileTypes: true }).catch(() => []);
    const results: Array<{ connection: ConnectionRecord; path: string }> = [];

    for (const entry of platforms) {
      if (!entry.isDirectory() || !isPlatform(entry.name)) {
        continue;
      }

      const connectionDir = getPlatformConnectionDir(entry.name);
      const files = await readdir(connectionDir, { withFileTypes: true }).catch(() => []);
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json")) {
          continue;
        }

        const path = `${connectionDir}/${file.name}`;
        const raw = await readFile(path, "utf8").catch(() => null);
        if (!raw) {
          continue;
        }

        try {
          results.push({
            connection: ConnectionRecordSchema.parse(JSON.parse(raw)),
            path,
          });
        } catch {
          continue;
        }
      }
    }

    return results;
  }

  private async resolveDefaultStoredAccount(platform: Platform): Promise<string> {
    const platformConnections = (await this.listStoredConnections()).filter(({ connection }) => connection.platform === platform);
    if (platformConnections.length === 0) {
      throw new AutoCliError("CONNECTION_NOT_FOUND", `No saved ${platform} connections found.`, {
        details: { platform },
      });
    }

    return platformConnections.sort((left, right) => right.connection.updatedAt.localeCompare(left.connection.updatedAt))[0]
      ?.connection.account ?? sanitizeAccountName("default");
  }

  private toKey(platform: Platform, account: string): string {
    return `${platform}:${sanitizeAccountName(account)}`;
  }
}

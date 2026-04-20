import { DEFAULT_ACCOUNT_NAME } from "../../../config.js";
import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { MikaCliError, toError } from "../../../errors.js";
import { promptForInput } from "../../../utils/terminal-prompt.js";
import { printTerminalQr } from "../../../utils/terminal-qr.js";

import type { AdapterActionResult, AdapterStatusResult, SessionStatus, SessionUser } from "../../../types.js";
import type { ConnectionRecord } from "../../../core/auth/auth-types.js";
import type { Api, TelegramClient } from "telegram";

const PLATFORM = "telegram" as const;
const DEFAULT_LIMIT = 20;

interface TelegramStoredMetadata {
  apiId: number;
  apiHash: string;
  sessionString: string;
  loginMode: "session-string" | "phone" | "qr";
  phone?: string;
}

interface TelegramLoginInput {
  account?: string;
  apiId?: number | string;
  apiHash?: string;
  sessionString?: string;
  phone?: string;
  code?: string;
  password?: string;
  qr?: boolean;
  json?: boolean;
}

interface TelegramTargetInput {
  account?: string;
  target: string;
}

interface TelegramHistoryInput extends TelegramTargetInput {
  limit?: number;
}

interface TelegramSendInput extends TelegramTargetInput {
  text: string;
}

type TelegramClientInstance = TelegramClient;
type TelegramUserLike = Api.TypeUser | Api.User | undefined | null;
type TelegramMessageLike = Api.Message | undefined | null;
type TelegramRuntime = {
  Api: typeof import("telegram").Api;
  TelegramClient: typeof import("telegram").TelegramClient;
  StringSession: typeof import("telegram/sessions/index.js").StringSession;
};

let telegramRuntimePromise: Promise<TelegramRuntime> | null = null;

export class TelegramSocialService {
  private readonly connectionStore = new ConnectionStore();

  async login(input: TelegramLoginInput): Promise<AdapterActionResult> {
    const apiId = parseApiId(input.apiId);
    const apiHash = requireNonEmpty(input.apiHash, "TELEGRAM_API_HASH_REQUIRED", "Telegram login requires --api-hash.");
    const initialSession = input.sessionString?.trim() ?? "";
    const { TelegramClient, StringSession } = await loadTelegramRuntime();
    const client = new TelegramClient(new StringSession(initialSession), apiId, apiHash, {
      connectionRetries: 3,
      useWSS: true,
    });

    try {
      await client.connect();

      let user: TelegramUserLike;
      if (initialSession.length > 0) {
        const authorized = await client.checkAuthorization();
        if (!authorized) {
          throw new MikaCliError(
            "TELEGRAM_SESSION_INVALID",
            "Telegram rejected the provided session string. Generate a fresh session or log in again.",
          );
        }

        user = await client.getMe();
      } else if (input.qr) {
        user = await client.signInUserWithQrCode(
          { apiId, apiHash },
          {
            qrCode: async (qrCode) => {
              const loginUri = `tg://login?token=${qrCode.token.toString("base64url")}`;
              await printTerminalQr(
                loginUri,
                "Scan this QR in Telegram > Settings > Devices > Link Desktop Device",
                input.json ? "stderr" : "stdout",
              );
            },
            password: async (hint) =>
              getOptionalSecret(
                input.password,
                hint ? `Telegram 2FA password (${hint})` : "Telegram 2FA password",
              ),
            onError: async (error) => {
              throw toError(error);
            },
          },
        );
      } else {
        user = await client.signInUser(
          { apiId, apiHash },
          {
            phoneNumber: async () => getRequiredValue(input.phone, "Telegram phone number (+countrycode)"),
            phoneCode: async () => getRequiredValue(input.code, "Telegram login code"),
            password: async (hint) =>
              getOptionalSecret(
                input.password,
                hint ? `Telegram 2FA password (${hint})` : "Telegram 2FA password",
              ),
            onError: async (error) => {
              if (input.code || input.password) {
                return true;
              }

              console.error(`Telegram login retry: ${toError(error).message}`);
              return false;
            },
          },
        );
      }

      const sessionString = extractTelegramSessionString(client);
      const normalizedUser = normalizeTelegramUser(user);
      const account = input.account?.trim() || normalizedUser.username || DEFAULT_ACCOUNT_NAME;
      const status = activeStatus("Telegram user session is ready.");
      const sessionPath = await this.connectionStore.saveSessionConnection({
        platform: PLATFORM,
        account,
        provider: "mtproto",
        user: normalizedUser,
        status,
        metadata: {
          apiId,
          apiHash,
          sessionString,
          loginMode: initialSession.length > 0 ? "session-string" : input.qr ? "qr" : "phone",
          phone: input.phone,
        } satisfies TelegramStoredMetadata,
      });

      return {
        ok: true,
        platform: PLATFORM,
        account,
        action: "login",
        message: "Telegram session imported.",
        sessionPath,
        user: normalizedUser,
        data: {
          status: status.state,
          mode: initialSession.length > 0 ? "session-string" : input.qr ? "qr" : "phone",
        },
      };
    } finally {
      await safelyDisconnectTelegram(client);
    }
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.connectionStore.loadSessionConnection(PLATFORM, account);
    const metadata = parseTelegramMetadata(loaded.connection);
    const client = await this.connectStoredClient(metadata);

    try {
      const authorized = await client.checkAuthorization();
      if (!authorized) {
        return {
          platform: PLATFORM,
          account: loaded.connection.account,
          sessionPath: loaded.path,
          connected: false,
          status: "expired",
          message: "Telegram session is no longer authorized. Log in again.",
          user: loaded.connection.user,
          lastValidatedAt: new Date().toISOString(),
        };
      }

      const me = normalizeTelegramUser(await client.getMe());
      await this.persistRefreshedSession(loaded.connection, metadata, client, me, "Telegram user session is active.");
      return {
        platform: PLATFORM,
        account: loaded.connection.account,
        sessionPath: loaded.path,
        connected: true,
        status: "active",
        message: "Telegram user session is active.",
        user: me,
        lastValidatedAt: new Date().toISOString(),
      };
    } finally {
      await safelyDisconnectTelegram(client);
    }
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const { account: resolvedAccount, metadata, client, connection } = await this.loadAuthorizedClient(account);

    try {
      const me = normalizeTelegramUser(await client.getMe());
      await this.persistRefreshedSession(connection, metadata, client, me, "Telegram profile loaded.");
      return {
        ok: true,
        platform: PLATFORM,
        account: resolvedAccount,
        action: "me",
        message: "Telegram profile loaded.",
        user: me,
        data: {
          profile: me,
        },
      };
    } finally {
      await safelyDisconnectTelegram(client);
    }
  }

  async chats(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const { account, metadata, client, connection } = await this.loadAuthorizedClient(input.account);

    try {
      const dialogs = await client.getDialogs({ limit: normalizeLimit(input.limit) });
      const items = dialogs.map((dialog) => normalizeTelegramDialog(dialog));
      await this.persistRefreshedSession(connection, metadata, client, connection.user, "Telegram chats loaded.");

      return {
        ok: true,
        platform: PLATFORM,
        account,
        action: "chats",
        message: `Loaded ${items.length} Telegram chat${items.length === 1 ? "" : "s"}.`,
        user: connection.user,
        data: {
          items,
        },
      };
    } finally {
      await safelyDisconnectTelegram(client);
    }
  }

  async history(input: TelegramHistoryInput): Promise<AdapterActionResult> {
    const { account, metadata, client, connection } = await this.loadAuthorizedClient(input.account);

    try {
      const targetEntity = coerceTelegramTarget(input.target);
      const messages = await client.getMessages(targetEntity, { limit: normalizeLimit(input.limit) });
      const items = messages.map((message) => normalizeTelegramMessage(message));
      const target = normalizeTelegramEntity(await client.getEntity(targetEntity));
      await this.persistRefreshedSession(connection, metadata, client, connection.user, "Telegram chat history loaded.");

      return {
        ok: true,
        platform: PLATFORM,
        account,
        action: "history",
        message: `Loaded ${items.length} Telegram message${items.length === 1 ? "" : "s"}.`,
        user: connection.user,
        data: {
          target,
          items,
        },
      };
    } finally {
      await safelyDisconnectTelegram(client);
    }
  }

  async send(input: TelegramSendInput): Promise<AdapterActionResult> {
    const { account, metadata, client, connection } = await this.loadAuthorizedClient(input.account);

    try {
      const targetEntity = coerceTelegramTarget(input.target);
      const sent = await client.sendMessage(targetEntity, { message: input.text });
      const target = normalizeTelegramEntity(await client.getEntity(targetEntity));
      const targetUrl = typeof target.url === "string" ? target.url : undefined;
      await this.persistRefreshedSession(connection, metadata, client, connection.user, "Telegram message sent.");

      return {
        ok: true,
        platform: PLATFORM,
        account,
        action: "send",
        message: "Telegram message sent.",
        id: sent.id ? String(sent.id) : undefined,
        url: targetUrl,
        user: connection.user,
        data: {
          target,
          message: normalizeTelegramMessage(sent),
        },
      };
    } finally {
      await safelyDisconnectTelegram(client);
    }
  }

  private async loadAuthorizedClient(account?: string): Promise<{
    account: string;
    connection: ConnectionRecord;
    metadata: TelegramStoredMetadata;
    client: TelegramClientInstance;
  }> {
    const loaded = await this.connectionStore.loadSessionConnection(PLATFORM, account);
    const metadata = parseTelegramMetadata(loaded.connection);
    const client = await this.connectStoredClient(metadata);
    const authorized = await client.checkAuthorization();

    if (!authorized) {
      await safelyDisconnectTelegram(client);
      throw new MikaCliError("TELEGRAM_SESSION_EXPIRED", "Telegram session expired. Run social telegram login again.", {
        details: {
          account: loaded.connection.account,
          platform: PLATFORM,
          connectionPath: loaded.path,
        },
      });
    }

    return {
      account: loaded.connection.account,
      connection: loaded.connection,
      metadata,
      client,
    };
  }

  private async connectStoredClient(metadata: TelegramStoredMetadata): Promise<TelegramClientInstance> {
    const { TelegramClient, StringSession } = await loadTelegramRuntime();
    const client = new TelegramClient(new StringSession(metadata.sessionString), metadata.apiId, metadata.apiHash, {
      connectionRetries: 3,
      useWSS: true,
    });

    await client.connect();
    return client;
  }

  private async persistRefreshedSession(
    connection: ConnectionRecord,
    metadata: TelegramStoredMetadata,
    client: TelegramClientInstance,
    user: SessionUser | undefined,
    message: string,
  ): Promise<void> {
    await this.connectionStore.saveSessionConnection({
      platform: PLATFORM,
      account: connection.account,
      provider: "mtproto",
      user,
      status: activeStatus(message),
      metadata: {
        ...metadata,
        sessionString: extractTelegramSessionString(client),
      } satisfies TelegramStoredMetadata,
    });
  }
}

function parseTelegramMetadata(connection: ConnectionRecord): TelegramStoredMetadata {
  const apiId = connection.metadata?.apiId;
  const apiHash = connection.metadata?.apiHash;
  const sessionString = connection.metadata?.sessionString;
  const loginMode = connection.metadata?.loginMode;

  if (
    typeof apiId !== "number" ||
    !Number.isInteger(apiId) ||
    apiId <= 0 ||
    typeof apiHash !== "string" ||
    apiHash.trim().length === 0 ||
    typeof sessionString !== "string" ||
    sessionString.trim().length === 0 ||
    (loginMode !== "session-string" && loginMode !== "phone" && loginMode !== "qr")
  ) {
    throw new MikaCliError(
      "TELEGRAM_SESSION_INVALID",
      "The saved Telegram session is missing apiId, apiHash, or session string metadata.",
      {
        details: {
          platform: connection.platform,
          account: connection.account,
        },
      },
    );
  }

  return {
    apiId,
    apiHash,
    sessionString,
    loginMode,
    phone: typeof connection.metadata?.phone === "string" ? connection.metadata.phone : undefined,
  };
}

function parseApiId(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw new MikaCliError("TELEGRAM_API_ID_REQUIRED", "Telegram login requires --api-id from my.telegram.org.", {
    details: {
      input: value,
    },
  });
}

function requireNonEmpty(value: string | undefined, code: string, message: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  throw new MikaCliError(code, message);
}

async function getRequiredValue(currentValue: string | undefined, label: string): Promise<string> {
  if (typeof currentValue === "string" && currentValue.trim().length > 0) {
    return currentValue.trim();
  }

  return promptForInput(label);
}

async function getOptionalSecret(currentValue: string | undefined, label: string): Promise<string> {
  if (typeof currentValue === "string" && currentValue.trim().length > 0) {
    return currentValue;
  }

  return promptForInput(label, { secret: true });
}

function activeStatus(message: string): SessionStatus {
  return {
    state: "active",
    message,
    lastValidatedAt: new Date().toISOString(),
  };
}

function normalizeLimit(value?: number): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(100, Math.trunc(value)));
}

function normalizeTelegramUser(user: TelegramUserLike): SessionUser {
  if (!user || typeof user !== "object") {
    return {};
  }

  const source = user as unknown as {
    id?: { toString(): string } | number | string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  const name = [source.firstName, source.lastName].filter(Boolean).join(" ").trim();
  return {
    id: source.id ? String(source.id) : undefined,
    username: source.username ?? undefined,
    displayName: name.length > 0 ? name : source.username ?? undefined,
    profileUrl: source.username ? `https://t.me/${source.username}` : undefined,
  };
}

function normalizeTelegramDialog(dialog: unknown): Record<string, unknown> {
  const source = dialog as Record<string, unknown>;
  const entity = asRecord(source.entity);
  const title = pickString(source.title, entity.title, entity.username, entity.firstName);
  const username = pickString(source.name, entity.username);
  const folderId = typeof source.folderId === "number" ? source.folderId : undefined;

  return {
    id: pickString(source.id) ?? (typeof source.id === "number" ? String(source.id) : undefined),
    title,
    username,
    unreadCount: typeof source.unreadCount === "number" ? source.unreadCount : undefined,
    pinned: typeof source.pinned === "boolean" ? source.pinned : undefined,
    archived: folderId === 1,
    isChannel: typeof source.isChannel === "boolean" ? source.isChannel : undefined,
    isGroup: typeof source.isGroup === "boolean" ? source.isGroup : undefined,
    url: username ? `https://t.me/${username}` : undefined,
  };
}

function normalizeTelegramMessage(message: TelegramMessageLike): Record<string, unknown> {
  if (!message) {
    return {};
  }

  return {
    id: typeof message.id === "number" ? String(message.id) : undefined,
    text: message.message ?? undefined,
    date: normalizeTelegramDate(message.date),
    out: message.out ?? undefined,
    replyTo: message.replyTo?.replyToMsgId ? String(message.replyTo.replyToMsgId) : undefined,
    views: typeof message.views === "number" ? message.views : undefined,
  };
}

function normalizeTelegramEntity(entity: unknown): Record<string, unknown> {
  const source = entity as Record<string, unknown>;
  const username = pickString(source.username);
  const displayName = [pickString(source.firstName), pickString(source.lastName)].filter(Boolean).join(" ").trim();
  return {
    id: typeof source.id === "number" ? String(source.id) : undefined,
    username,
    title: pickString(source.title) ?? (displayName.length > 0 ? displayName : undefined),
    url: username ? `https://t.me/${username}` : undefined,
  };
}

function coerceTelegramTarget(target: string): string | number {
  const normalized = target.trim();
  if (normalized.length === 0) {
    throw new MikaCliError("TELEGRAM_TARGET_REQUIRED", "Telegram target is required.");
  }

  if (/^-?\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

async function safelyDisconnectTelegram(client: TelegramClientInstance): Promise<void> {
  try {
    await client.disconnect();
  } catch {
    // noop
  }
}

function extractTelegramSessionString(client: TelegramClientInstance): string {
  const session = client.session as unknown;
  if (session && typeof session === "object" && "save" in session && typeof session.save === "function") {
    const value = session.save();
    if (typeof value === "string") {
      return value;
    }
  }

  throw new MikaCliError("TELEGRAM_SESSION_SERIALIZE_FAILED", "Unable to serialize the Telegram session string.");
}

function normalizeTelegramDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return undefined;
}

async function loadTelegramRuntime(): Promise<TelegramRuntime> {
  if (!telegramRuntimePromise) {
    telegramRuntimePromise = Promise.all([
      import("telegram"),
      import("telegram/sessions/index.js"),
    ]).then(([telegram, sessions]) => ({
      Api: telegram.Api,
      TelegramClient: telegram.TelegramClient,
      StringSession: sessions.StringSession,
    }));
  }

  return telegramRuntimePromise;
}

export const telegramSocialService = new TelegramSocialService();

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stderr } from "node:process";

import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "@whiskeysockets/baileys";

import { DEFAULT_ACCOUNT_NAME, ensureConnectionDirectory, getPlatformConnectionDir, sanitizeAccountName } from "../../../config.js";
import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { MikaCliError } from "../../../errors.js";
import { printTerminalQr } from "../../../utils/terminal-qr.js";

import type { AdapterActionResult, AdapterStatusResult, SessionStatus, SessionUser } from "../../../types.js";
import type { ConnectionRecord } from "../../../core/auth/auth-types.js";

const PLATFORM = "whatsapp" as const;
const DISPLAY_NAME = "WhatsApp";
const CACHE_FILE_NAME = "mikacli-cache.json";
const DEFAULT_LIMIT = 20;
const DEFAULT_SYNC_WAIT_MS = 4000;
const MAX_CACHE_MESSAGES_PER_CHAT = 100;

interface WhatsAppStoredMetadata {
  authDir: string;
  cachePath: string;
  loginMode: "qr" | "pairing-code";
  phone?: string;
}

type WhatsAppOpenResult = ActiveWhatsAppConnection | { restart: true };

interface WhatsAppChatSummary {
  jid: string;
  name?: string;
  unreadCount?: number;
  archived?: boolean;
  pinned?: boolean;
  isGroup?: boolean;
  lastMessageTimestamp?: number;
}

interface WhatsAppMessageSummary {
  jid: string;
  id?: string;
  text?: string;
  timestamp?: string;
  fromMe?: boolean;
  sender?: string;
  pushName?: string;
  type?: string;
}

interface WhatsAppCache {
  updatedAt: string;
  chats: WhatsAppChatSummary[];
  messagesByJid: Record<string, WhatsAppMessageSummary[]>;
}

interface WhatsAppLoginInput {
  account?: string;
  phone?: string;
  json?: boolean;
}

interface WhatsAppCommandInput {
  account?: string;
}

interface WhatsAppTargetInput extends WhatsAppCommandInput {
  target: string;
}

interface WhatsAppHistoryInput extends WhatsAppTargetInput {
  limit?: number;
}

interface WhatsAppSendInput extends WhatsAppTargetInput {
  text: string;
}

type ActiveWhatsAppConnection = {
  account: string;
  metadata: WhatsAppStoredMetadata;
  connection: ConnectionRecord;
  sock: ReturnType<typeof makeWASocket>;
  cache: WhatsAppCache;
  user?: SessionUser;
  stop(): Promise<void>;
};

export class WhatsAppSocialService {
  private readonly connectionStore = new ConnectionStore();

  async login(input: WhatsAppLoginInput): Promise<AdapterActionResult> {
    const account = sanitizeAccountName(input.account ?? DEFAULT_ACCOUNT_NAME);
    const metadata = {
      authDir: getWhatsAppAuthDir(account),
      cachePath: getWhatsAppCachePath(account),
      loginMode: input.phone ? "pairing-code" : "qr",
      phone: input.phone,
    } satisfies WhatsAppStoredMetadata;

    const active = await this.openConnection({
      account,
      metadata,
      allowBootstrap: true,
      pairingPhone: input.phone,
      printQr: true,
      printToStdErr: Boolean(input.json),
      syncWaitMs: 6000,
    });

    try {
      const user = active.user ?? {};
      const sessionPath = await this.connectionStore.saveSessionConnection({
        platform: PLATFORM,
        account,
        provider: "baileys",
        user,
        status: activeStatus("WhatsApp user session is active."),
        metadata,
      });

      return {
        ok: true,
        platform: PLATFORM,
        account,
        action: "login",
        message: "WhatsApp session imported.",
        sessionPath,
        user,
        data: {
          status: "active",
          mode: metadata.loginMode,
        },
      };
    } finally {
      await active.stop();
    }
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.connectionStore.loadSessionConnection(PLATFORM, account);
    const metadata = parseWhatsAppMetadata(loaded.connection);

    try {
      const active = await this.openConnection({
        account: loaded.connection.account,
        metadata,
        allowBootstrap: false,
        syncWaitMs: 1500,
      });

      try {
        await this.connectionStore.saveSessionConnection({
          platform: PLATFORM,
          account: loaded.connection.account,
          provider: "baileys",
          user: active.user ?? loaded.connection.user,
          status: activeStatus("WhatsApp user session is active."),
          metadata: { ...metadata },
        });

        return {
          platform: PLATFORM,
          account: loaded.connection.account,
          sessionPath: loaded.path,
          connected: true,
          status: "active",
          message: "WhatsApp user session is active.",
          user: active.user ?? loaded.connection.user,
          lastValidatedAt: new Date().toISOString(),
        };
      } finally {
        await active.stop();
      }
    } catch (error) {
      if (error instanceof MikaCliError) {
        return {
          platform: PLATFORM,
          account: loaded.connection.account,
          sessionPath: loaded.path,
          connected: false,
          status: "expired",
          message: error.message,
          user: loaded.connection.user,
          lastValidatedAt: new Date().toISOString(),
        };
      }

      throw error;
    }
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const active = await this.loadAuthorizedConnection(account);

    try {
      await this.persistActiveConnection(active, "WhatsApp profile loaded.");
      return {
        ok: true,
        platform: PLATFORM,
        account: active.account,
        action: "me",
        message: "WhatsApp profile loaded.",
        user: active.user,
        data: {
          profile: active.user,
        },
      };
    } finally {
      await active.stop();
    }
  }

  async chats(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.loadAuthorizedConnection(input.account, 3500);

    try {
      const items = [...active.cache.chats]
        .sort((left, right) => (right.lastMessageTimestamp ?? 0) - (left.lastMessageTimestamp ?? 0))
        .slice(0, normalizeLimit(input.limit));
      await this.persistActiveConnection(active, `Loaded ${items.length} WhatsApp chat${items.length === 1 ? "" : "s"}.`);

      return {
        ok: true,
        platform: PLATFORM,
        account: active.account,
        action: "chats",
        message: `Loaded ${items.length} WhatsApp chat${items.length === 1 ? "" : "s"}.`,
        user: active.user,
        data: {
          items,
        },
      };
    } finally {
      await active.stop();
    }
  }

  async history(input: WhatsAppHistoryInput): Promise<AdapterActionResult> {
    const active = await this.loadAuthorizedConnection(input.account, 3500);

    try {
      const jid = await resolveWhatsAppTarget(active.sock, input.target);
      const items = (active.cache.messagesByJid[jid] ?? []).slice(-normalizeLimit(input.limit));
      await this.persistActiveConnection(active, `Loaded ${items.length} WhatsApp message${items.length === 1 ? "" : "s"}.`);

      return {
        ok: true,
        platform: PLATFORM,
        account: active.account,
        action: "history",
        message:
          items.length > 0
            ? `Loaded ${items.length} WhatsApp message${items.length === 1 ? "" : "s"}.`
            : "No cached WhatsApp messages found for that chat yet.",
        user: active.user,
        data: {
          target: { jid },
          items,
        },
      };
    } finally {
      await active.stop();
    }
  }

  async send(input: WhatsAppSendInput): Promise<AdapterActionResult> {
    const active = await this.loadAuthorizedConnection(input.account, 1500);

    try {
      const jid = await resolveWhatsAppTarget(active.sock, input.target);
      const sent = await active.sock.sendMessage(jid, { text: input.text });
      const summary = normalizeWhatsAppMessage(sent);
      mergeMessage(active.cache, summary);
      await this.persistActiveConnection(active, "WhatsApp message sent.");

      return {
        ok: true,
        platform: PLATFORM,
        account: active.account,
        action: "send",
        message: "WhatsApp message sent.",
        id: summary.id,
        user: active.user,
        data: {
          target: { jid },
          message: summary,
        },
      };
    } finally {
      await active.stop();
    }
  }

  private async loadAuthorizedConnection(account?: string, syncWaitMs = DEFAULT_SYNC_WAIT_MS): Promise<ActiveWhatsAppConnection> {
    const loaded = await this.connectionStore.loadSessionConnection(PLATFORM, account);
    const metadata = parseWhatsAppMetadata(loaded.connection);
    return this.openConnection({
      account: loaded.connection.account,
      metadata,
      allowBootstrap: false,
      syncWaitMs,
      savedConnection: loaded.connection,
    });
  }

  private async persistActiveConnection(active: ActiveWhatsAppConnection, message: string): Promise<void> {
    await this.connectionStore.saveSessionConnection({
      platform: PLATFORM,
      account: active.account,
      provider: "baileys",
      user: active.user,
      status: activeStatus(message),
      metadata: { ...active.metadata },
    });
  }

  private async openConnection(input: {
    account: string;
    metadata: WhatsAppStoredMetadata;
    allowBootstrap: boolean;
    pairingPhone?: string;
    printQr?: boolean;
    printToStdErr?: boolean;
    syncWaitMs?: number;
    savedConnection?: ConnectionRecord;
  }): Promise<ActiveWhatsAppConnection> {
    const firstAttempt = await this.openConnectionAttempt(input);
    if (!("restart" in firstAttempt)) {
      return firstAttempt;
    }

    return this.openConnectionAttemptOrThrow({
      ...input,
      allowBootstrap: false,
      pairingPhone: undefined,
      printQr: false,
      printToStdErr: false,
    });
  }

  private async openConnectionAttemptOrThrow(input: {
    account: string;
    metadata: WhatsAppStoredMetadata;
    allowBootstrap: boolean;
    pairingPhone?: string;
    printQr?: boolean;
    printToStdErr?: boolean;
    syncWaitMs?: number;
    savedConnection?: ConnectionRecord;
  }): Promise<ActiveWhatsAppConnection> {
    const result = await this.openConnectionAttempt(input);
    if ("restart" in result) {
      throw new MikaCliError("WHATSAPP_CONNECTION_RESTART_LOOP", "WhatsApp requested another restart before the session opened.");
    }

    return result;
  }

  private async openConnectionAttempt(input: {
    account: string;
    metadata: WhatsAppStoredMetadata;
    allowBootstrap: boolean;
    pairingPhone?: string;
    printQr?: boolean;
    printToStdErr?: boolean;
    syncWaitMs?: number;
    savedConnection?: ConnectionRecord;
  }): Promise<WhatsAppOpenResult> {
    await ensureConnectionDirectory(PLATFORM);

    const cache = await readWhatsAppCache(input.metadata.cachePath);
    const { state, saveCreds } = await useMultiFileAuthState(input.metadata.authDir);
    const version = await fetchLatestBaileysVersion().catch(() => null);
    const sock = makeWASocket({
      auth: state,
      browser: ["MikaCLI", "Desktop", "1.0.0"],
      logger: createSilentBaileysLogger(),
      markOnlineOnConnect: false,
      syncFullHistory: true,
      version: version?.version,
    });

    let pairingCodePrinted = false;
    let openResolved = false;
    let qrSeen = false;

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messaging-history.set", (payload) => {
      for (const chat of payload.chats) {
        mergeChat(cache, normalizeWhatsAppChat(chat));
      }
      for (const message of payload.messages) {
        mergeMessage(cache, normalizeWhatsAppMessage(message));
      }
    });
    sock.ev.on("chats.upsert", (payload) => {
      for (const chat of payload) {
        mergeChat(cache, normalizeWhatsAppChat(chat));
      }
    });
    sock.ev.on("chats.update", (payload) => {
      for (const chat of payload) {
        mergeChat(cache, normalizeWhatsAppChat(chat));
      }
    });
    sock.ev.on("messages.upsert", (payload) => {
      for (const message of payload.messages) {
        mergeMessage(cache, normalizeWhatsAppMessage(message));
      }
    });

    const openPromise = new Promise<"open" | "restart">((resolve, reject) => {
      sock.ev.on("connection.update", async (update) => {
        if (update.qr && input.printQr) {
          qrSeen = true;
          await printTerminalQr(
            update.qr,
            "Scan this QR in WhatsApp > Linked Devices",
            input.printToStdErr ? "stderr" : "stdout",
          );
        }

        if (input.pairingPhone && !pairingCodePrinted && !state.creds.registered) {
          pairingCodePrinted = true;
          try {
            const pairingCode = await sock.requestPairingCode(normalizePhoneNumber(input.pairingPhone));
            const sink = input.printToStdErr ? stderr : process.stdout;
            sink.write(`Pairing code: ${pairingCode}\n`);
          } catch (error) {
            reject(
              new MikaCliError("WHATSAPP_PAIRING_CODE_FAILED", "Failed to generate a WhatsApp pairing code.", {
                cause: error,
                details: {
                  phone: input.pairingPhone,
                },
              }),
            );
          }
        }

        if (update.connection === "open") {
          openResolved = true;
          resolve("open");
          return;
        }

        if (update.connection === "close") {
          const disconnect = update.lastDisconnect?.error as { output?: { statusCode?: number }; message?: string } | undefined;
          const statusCode = disconnect?.output?.statusCode;

          if (statusCode === DisconnectReason.restartRequired) {
            cache.updatedAt = new Date().toISOString();
            await writeWhatsAppCache(input.metadata.cachePath, cache);
            try {
              sock.end(undefined);
            } catch {
              // noop
            }
            resolve("restart");
            return;
          }

          if (statusCode === DisconnectReason.loggedOut || (!input.allowBootstrap && qrSeen)) {
            reject(
              new MikaCliError(
                "WHATSAPP_SESSION_EXPIRED",
                "WhatsApp session expired or was logged out. Run social whatsapp login again.",
              ),
            );
            return;
          }

          reject(
            new MikaCliError("WHATSAPP_CONNECTION_CLOSED", disconnect?.message ?? "WhatsApp closed the session unexpectedly."),
          );
        }
      });
    });

    try {
      const outcome = await withTimeout(openPromise, 120_000, "WhatsApp login timed out. Scan the QR or finish pairing, then try again.");
      if (outcome === "restart") {
        return { restart: true };
      }

      await wait(input.syncWaitMs ?? DEFAULT_SYNC_WAIT_MS);
      cache.updatedAt = new Date().toISOString();
      await writeWhatsAppCache(input.metadata.cachePath, cache);

      const user = normalizeWhatsAppUser(sock.user ?? state.creds.me);
      return {
        account: input.account,
        metadata: input.metadata,
        connection: input.savedConnection ?? makePlaceholderConnection(input.account, user),
        sock,
        cache,
        user,
        stop: async () => {
          cache.updatedAt = new Date().toISOString();
          await writeWhatsAppCache(input.metadata.cachePath, cache);
          try {
            sock.end(undefined);
          } catch {
            // noop
          }
        },
      };
    } catch (error) {
      if (!openResolved) {
        try {
          sock.end(undefined);
        } catch {
          // noop
        }
      }
      throw error;
    }
  }
}

function parseWhatsAppMetadata(connection: ConnectionRecord): WhatsAppStoredMetadata {
  const authDir = connection.metadata?.authDir;
  const cachePath = connection.metadata?.cachePath;
  const loginMode = connection.metadata?.loginMode;
  const phone = connection.metadata?.phone;

  if (
    typeof authDir !== "string" ||
    authDir.trim().length === 0 ||
    typeof cachePath !== "string" ||
    cachePath.trim().length === 0 ||
    (loginMode !== "qr" && loginMode !== "pairing-code")
  ) {
    throw new MikaCliError(
      "WHATSAPP_SESSION_INVALID",
      "The saved WhatsApp session is missing its auth directory metadata. Log in again.",
      {
        details: {
          platform: connection.platform,
          account: connection.account,
        },
      },
    );
  }

  return {
    authDir,
    cachePath,
    loginMode,
    phone: typeof phone === "string" ? phone : undefined,
  };
}

function getWhatsAppAuthDir(account: string): string {
  return join(getPlatformConnectionDir(PLATFORM), `${sanitizeAccountName(account)}.state`);
}

function getWhatsAppCachePath(account: string): string {
  return join(getWhatsAppAuthDir(account), CACHE_FILE_NAME);
}

async function readWhatsAppCache(path: string): Promise<WhatsAppCache> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<WhatsAppCache>;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messagesByJid:
        parsed.messagesByJid && typeof parsed.messagesByJid === "object" && !Array.isArray(parsed.messagesByJid)
          ? (parsed.messagesByJid as Record<string, WhatsAppMessageSummary[]>)
          : {},
    };
  } catch {
    return {
      updatedAt: new Date(0).toISOString(),
      chats: [],
      messagesByJid: {},
    };
  }
}

async function writeWhatsAppCache(path: string, cache: WhatsAppCache): Promise<void> {
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function normalizeWhatsAppUser(user: unknown): SessionUser | undefined {
  const source = asRecord(user);
  const id = pickString(source.id);
  const name = pickString(source.name, source.verifiedName, source.notify);
  return {
    id,
    username: id ? stripWhatsAppSuffix(id) : undefined,
    displayName: name ?? (id ? stripWhatsAppSuffix(id) : undefined),
    profileUrl: undefined,
  };
}

function normalizeWhatsAppChat(chat: unknown): WhatsAppChatSummary {
  const source = asRecord(chat);
  const jid = pickString(source.id) ?? pickString(source.jid) ?? "";
  return {
    jid,
    name: pickString(source.name, source.subject, source.conversationName, source.pushName),
    unreadCount: typeof source.unreadCount === "number" ? source.unreadCount : undefined,
    archived: typeof source.archived === "boolean" ? source.archived : undefined,
    pinned: typeof source.pinned === "boolean" ? source.pinned : undefined,
    isGroup: typeof jid === "string" ? jid.endsWith("@g.us") : undefined,
    lastMessageTimestamp: normalizeMaybeNumber(source.conversationTimestamp, source.lastMessageRecvTimestamp),
  };
}

function normalizeWhatsAppMessage(message: unknown): WhatsAppMessageSummary {
  const source = asRecord(message);
  const key = asRecord(source.key);
  const jid = pickString(key.remoteJid) ?? "";
  const timestamp = normalizeTimestamp(source.messageTimestamp);

  return {
    jid,
    id: pickString(key.id),
    text: extractWhatsAppText(asRecord(source.message)),
    timestamp,
    fromMe: typeof key.fromMe === "boolean" ? key.fromMe : undefined,
    sender: pickString(key.participant, key.remoteJid),
    pushName: pickString(source.pushName),
    type: firstMessageType(asRecord(source.message)),
  };
}

function mergeChat(cache: WhatsAppCache, chat: WhatsAppChatSummary): void {
  if (!chat.jid) {
    return;
  }

  const index = cache.chats.findIndex((entry) => entry.jid === chat.jid);
  if (index >= 0) {
    cache.chats[index] = {
      ...cache.chats[index],
      ...chat,
    };
    return;
  }

  cache.chats.push(chat);
}

function mergeMessage(cache: WhatsAppCache, message: WhatsAppMessageSummary): void {
  if (!message.jid || !message.id) {
    return;
  }

  const messages = cache.messagesByJid[message.jid] ?? [];
  const existingIndex = messages.findIndex((entry) => entry.id === message.id);
  if (existingIndex >= 0) {
    messages[existingIndex] = {
      ...messages[existingIndex],
      ...message,
    };
  } else {
    messages.push(message);
    if (messages.length > MAX_CACHE_MESSAGES_PER_CHAT) {
      messages.splice(0, messages.length - MAX_CACHE_MESSAGES_PER_CHAT);
    }
  }
  cache.messagesByJid[message.jid] = messages;
}

async function resolveWhatsAppTarget(sock: ReturnType<typeof makeWASocket>, target: string): Promise<string> {
  const normalized = target.trim();
  if (normalized.length === 0) {
    throw new MikaCliError("WHATSAPP_TARGET_REQUIRED", "WhatsApp target is required.");
  }

  if (normalized.includes("@")) {
    return normalized;
  }

  const phone = normalizePhoneNumber(normalized);
  const matches = await sock.onWhatsApp(phone).catch(() => undefined);
  const jid = matches?.find((entry) => entry.exists)?.jid;
  if (jid) {
    return jid;
  }

  return `${phone}@s.whatsapp.net`;
}

function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 6) {
    throw new MikaCliError("WHATSAPP_PHONE_INVALID", "WhatsApp pairing/login requires a valid phone number.");
  }

  return digits;
}

function normalizeLimit(value?: number): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(100, Math.trunc(value)));
}

function normalizeTimestamp(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const millis = value > 10_000_000_000 ? value : value * 1000;
      return new Date(millis).toISOString();
    }

    if (typeof value === "bigint") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
        return new Date(millis).toISOString();
      }
    }

    if (value && typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
      const numeric = Number((value as { toNumber(): number }).toNumber());
      if (Number.isFinite(numeric)) {
        const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
        return new Date(millis).toISOString();
      }
    }
  }

  return undefined;
}

function normalizeMaybeNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "bigint") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    if (value && typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
      const numeric = Number((value as { toNumber(): number }).toNumber());
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
  }

  return undefined;
}

function extractWhatsAppText(message: Record<string, unknown>): string | undefined {
  const conversation = pickString(message.conversation);
  if (conversation) {
    return conversation;
  }

  const extendedText = asRecord(message.extendedTextMessage);
  const extended = pickString(extendedText.text);
  if (extended) {
    return extended;
  }

  const image = asRecord(message.imageMessage);
  const imageCaption = pickString(image.caption);
  if (imageCaption) {
    return imageCaption;
  }

  const video = asRecord(message.videoMessage);
  const videoCaption = pickString(video.caption);
  if (videoCaption) {
    return videoCaption;
  }

  const documentWithCaption = asRecord(message.documentWithCaptionMessage);
  const embeddedDocument = asRecord(documentWithCaption.message);
  const documentCaption = pickString(asRecord(embeddedDocument.documentMessage).caption);
  if (documentCaption) {
    return documentCaption;
  }

  const buttons = asRecord(message.buttonsResponseMessage);
  const selectedButton = pickString(buttons.selectedDisplayText);
  if (selectedButton) {
    return selectedButton;
  }

  return undefined;
}

function firstMessageType(message: Record<string, unknown>): string | undefined {
  for (const key of Object.keys(message)) {
    if (key !== "messageContextInfo") {
      return key;
    }
  }

  return undefined;
}

function stripWhatsAppSuffix(value: string): string {
  return value.replace(/@.+$/, "");
}

function activeStatus(message: string): SessionStatus {
  return {
    state: "active",
    message,
    lastValidatedAt: new Date().toISOString(),
  };
}

function makePlaceholderConnection(account: string, user?: SessionUser): ConnectionRecord {
  const now = new Date().toISOString();
  return {
    version: 1,
    platform: PLATFORM,
    account,
    createdAt: now,
    updatedAt: now,
    auth: { kind: "session", provider: "baileys" },
    status: activeStatus("WhatsApp session is active."),
    user,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new MikaCliError("WHATSAPP_TIMEOUT", message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function createSilentBaileysLogger() {
  const logger = {
    level: "silent",
    child() {
      return logger;
    },
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
  };

  return logger;
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

export const whatsappSocialService = new WhatsAppSocialService();

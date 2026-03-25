import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { AutoCliError } from "../../../errors.js";
import { sanitizeAccountName } from "../../../config.js";
import type { BotTokenConnectionAuth, ConnectionRecord } from "../../../core/auth/auth-types.js";
import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../../../types.js";

import { TelegramBotApi, type TelegramBotApiClient } from "./api.js";
import type { TelegramBotChat, TelegramBotMessage, TelegramBotUpdate, TelegramBotUser } from "./types.js";

const TELEGRAMBOT_PLATFORM = "telegrambot" as const;
const TELEGRAMBOT_DISPLAY_NAME = "Telegram Bot";

type TelegramUpdateSummary = {
  updateId: number;
  kind: string;
  chatId?: number;
  chatType?: TelegramBotChat["type"];
  chatName?: string;
  chatTitle?: string;
  chatUsername?: string;
  messagePreview?: string;
};

type TelegramChatSummary = {
  id: number;
  type: TelegramBotChat["type"];
  title?: string;
  username?: string;
  name?: string;
  lastMessagePreview?: string;
  updateId: number;
};

type TelegramBotMediaInput = {
  account?: string;
  chatId: string | number;
  media: string;
  caption?: string;
  parseMode?: string;
  replyToMessageId?: number;
};

interface TelegramBotAdapterDependencies {
  connectionStore?: Pick<ConnectionStore, "saveBotTokenConnection" | "loadBotTokenConnection">;
  createApi?: (token: string) => TelegramBotApiClient;
}

export class TelegramBotAdapter {
  readonly platform = TELEGRAMBOT_PLATFORM;
  readonly displayName = TELEGRAMBOT_DISPLAY_NAME;

  private readonly connectionStore: Pick<ConnectionStore, "saveBotTokenConnection" | "loadBotTokenConnection">;
  private readonly createApi: (token: string) => TelegramBotApiClient;

  constructor(dependencies: TelegramBotAdapterDependencies = {}) {
    this.connectionStore = dependencies.connectionStore ?? new ConnectionStore();
    this.createApi = dependencies.createApi ?? ((token: string) => new TelegramBotApi(token));
  }

  async login(input: { account?: string; token?: string }): Promise<AdapterActionResult> {
    const token = input.token?.trim();
    if (!token) {
      throw new AutoCliError("INVALID_LOGIN_INPUT", "Provide a Telegram bot token with --token.");
    }

    const api = this.createApi(token);
    const me = await api.getMe();
    const now = new Date().toISOString();
    const account = sanitizeAccountName(input.account ?? me.username ?? me.first_name ?? `bot-${me.id}`);
    const sessionPath = await this.saveTelegramConnection({
      account,
      token,
      user: this.toSessionUser(me),
      status: {
        state: "active",
        message: "Telegram bot token validated via getMe().",
        lastValidatedAt: now,
      },
      metadata: {
        botUsername: me.username,
        botId: me.id,
        lastValidatedAt: now,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message: `Saved Telegram bot token for ${account}.`,
      user: this.toSessionUser(me),
      sessionPath,
      data: {
        botId: me.id,
        botUsername: me.username,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTelegramConnection(account);
    const api = this.createApi(loaded.auth.token);

    try {
      const me = await api.getMe();
      const now = new Date().toISOString();
      const status: SessionStatus = {
        state: "active",
        message: "Telegram bot token validated via getMe().",
        lastValidatedAt: now,
      };

      await this.saveTelegramConnection({
        account: loaded.connection.account,
        token: loaded.auth.token,
        existingSession: loaded.connection,
        user: this.toSessionUser(me),
        status,
        metadata: {
          ...(loaded.connection.metadata ?? {}),
          botUsername: me.username,
          botId: me.id,
          lastValidatedAt: now,
        },
      });

      return this.buildStatusResult({
        account: loaded.connection.account,
        sessionPath: loaded.path,
        status,
        user: this.toSessionUser(me),
      });
    } catch (error) {
      const status = this.toFailureStatus(error);
      await this.saveTelegramConnection({
        account: loaded.connection.account,
        token: loaded.auth.token,
        existingSession: loaded.connection,
        user: loaded.connection.user,
        status,
        metadata: {
          ...(loaded.connection.metadata ?? {}),
          lastValidatedAt: status.lastValidatedAt,
        },
      });

      return this.buildStatusResult({
        account: loaded.connection.account,
        sessionPath: loaded.path,
        status,
        user: loaded.connection.user,
      });
    }
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(account);
    const me = await this.createApi(loaded.auth.token).getMe();

    return {
      ok: true,
      platform: this.platform,
      account: loaded.connection.account,
      action: "me",
      message: `Loaded Telegram bot profile for ${me.username ? `@${me.username}` : me.first_name}.`,
      user: this.toSessionUser(me),
      sessionPath: loaded.path,
      data: {
        me,
      },
    };
  }

  async chats(input: { account?: string; limit?: number; offset?: number } = {}): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(input.account);
    const updates = await this.createApi(loaded.auth.token).getUpdates({
      limit: this.clampLimit(input.limit ?? 100),
      offset: input.offset,
    });

    const chats = this.summarizeChats(updates);
    return {
      ok: true,
      platform: this.platform,
      account: loaded.connection.account,
      action: "chats",
      message: `Loaded ${chats.length} Telegram chat${chats.length === 1 ? "" : "s"} from recent updates.`,
      sessionPath: loaded.path,
      data: {
        chats,
        updatesFetched: updates.length,
      },
    };
  }

  async getChat(input: { account?: string; chatId: string | number }): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(input.account);
    const chat = await this.createApi(loaded.auth.token).getChat(input.chatId);

    return {
      ok: true,
      platform: this.platform,
      account: loaded.connection.account,
      action: "getchat",
      message: `Loaded Telegram chat ${this.describeChat(chat)}.`,
      sessionPath: loaded.path,
      data: {
        chat,
      },
    };
  }

  async updates(input: { account?: string; limit?: number; offset?: number } = {}): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(input.account);
    const updates = await this.createApi(loaded.auth.token).getUpdates({
      limit: this.clampLimit(input.limit ?? 25),
      offset: input.offset,
    });

    return {
      ok: true,
      platform: this.platform,
      account: loaded.connection.account,
      action: "updates",
      message: `Loaded ${updates.length} Telegram update${updates.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      data: {
        updates: this.summarizeUpdates(updates),
      },
    };
  }

  async send(input: { account?: string; chatId: string | number; text: string; parseMode?: string; disableWebPagePreview?: boolean; replyToMessageId?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(input.account);
    const message = await this.createApi(loaded.auth.token).sendMessage({
      chatId: input.chatId,
      text: input.text,
      parseMode: input.parseMode,
      disableWebPagePreview: input.disableWebPagePreview,
      replyToMessageId: input.replyToMessageId,
    });

    return this.messageResult("send", loaded.connection.account, loaded.path, message, "Telegram message sent.");
  }

  async sendPhoto(input: { account?: string; chatId: string | number; photo: string; caption?: string; parseMode?: string; replyToMessageId?: number }): Promise<AdapterActionResult> {
    return this.sendMedia("send-photo", "sendPhoto", {
      account: input.account,
      chatId: input.chatId,
      media: input.photo,
      caption: input.caption,
      parseMode: input.parseMode,
      replyToMessageId: input.replyToMessageId,
    });
  }

  async sendDocument(input: { account?: string; chatId: string | number; document: string; caption?: string; parseMode?: string; replyToMessageId?: number }): Promise<AdapterActionResult> {
    return this.sendMedia("send-document", "sendDocument", {
      account: input.account,
      chatId: input.chatId,
      media: input.document,
      caption: input.caption,
      parseMode: input.parseMode,
      replyToMessageId: input.replyToMessageId,
    });
  }

  async sendVideo(input: { account?: string; chatId: string | number; video: string; caption?: string; parseMode?: string; replyToMessageId?: number }): Promise<AdapterActionResult> {
    return this.sendMedia("send-video", "sendVideo", {
      account: input.account,
      chatId: input.chatId,
      media: input.video,
      caption: input.caption,
      parseMode: input.parseMode,
      replyToMessageId: input.replyToMessageId,
    });
  }

  async sendAudio(input: { account?: string; chatId: string | number; audio: string; caption?: string; parseMode?: string; replyToMessageId?: number }): Promise<AdapterActionResult> {
    return this.sendMedia("send-audio", "sendAudio", {
      account: input.account,
      chatId: input.chatId,
      media: input.audio,
      caption: input.caption,
      parseMode: input.parseMode,
      replyToMessageId: input.replyToMessageId,
    });
  }

  async sendVoice(input: { account?: string; chatId: string | number; voice: string; caption?: string; parseMode?: string; replyToMessageId?: number }): Promise<AdapterActionResult> {
    return this.sendMedia("send-voice", "sendVoice", {
      account: input.account,
      chatId: input.chatId,
      media: input.voice,
      caption: input.caption,
      parseMode: input.parseMode,
      replyToMessageId: input.replyToMessageId,
    });
  }

  async edit(input: { account?: string; chatId?: string | number; messageId?: number; inlineMessageId?: string; text: string; parseMode?: string; disableWebPagePreview?: boolean; caption?: boolean }): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(input.account);
    const api = this.createApi(loaded.auth.token);
    const edited = input.caption
      ? await api.editMessageCaption({
          chatId: input.chatId,
          messageId: input.messageId,
          inlineMessageId: input.inlineMessageId,
          text: input.text,
          parseMode: input.parseMode,
        })
      : await api.editMessageText({
          chatId: input.chatId,
          messageId: input.messageId,
          inlineMessageId: input.inlineMessageId,
          text: input.text,
          parseMode: input.parseMode,
          disableWebPagePreview: input.disableWebPagePreview,
        });

    return this.messageResult(
      input.caption ? "edit-caption" : "edit",
      loaded.connection.account,
      loaded.path,
      edited,
      input.caption ? "Telegram message caption edited." : "Telegram message edited.",
    );
  }

  async delete(input: { account?: string; chatId: string | number; messageId: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(input.account);
    await this.createApi(loaded.auth.token).deleteMessage({
      chatId: input.chatId,
      messageId: input.messageId,
    });

    return {
      ok: true,
      platform: this.platform,
      account: loaded.connection.account,
      action: "delete",
      message: `Deleted Telegram message ${input.messageId} in chat ${input.chatId}.`,
      sessionPath: loaded.path,
      data: {
        chatId: input.chatId,
        messageId: input.messageId,
      },
    };
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "Telegram bots do not support a generic postMedia action. Use send-photo, send-document, or send-video.",
    );
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Telegram bots do not support a generic postText action. Use send.");
  }

  async like(_input: LikeInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Telegram bots do not support likes.");
  }

  async comment(_input: CommentInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Telegram bots do not support comments.");
  }

  private async loadTelegramConnection(account?: string): Promise<{
    connection: ConnectionRecord;
    path: string;
    auth: BotTokenConnectionAuth;
  }> {
    return this.connectionStore.loadBotTokenConnection(this.platform, account);
  }

  private async saveTelegramConnection(input: {
    account: string;
    token: string;
    user?: SessionUser;
    status: SessionStatus;
    metadata?: Record<string, unknown>;
    existingSession?: ConnectionRecord;
  }): Promise<string> {
    return this.connectionStore.saveBotTokenConnection({
      platform: this.platform,
      account: sanitizeAccountName(input.account),
      token: input.token,
      user: input.user,
      status: input.status,
      metadata: input.metadata,
      provider: "telegram",
    });
  }

  private toSessionUser(user: TelegramBotUser): SessionUser {
    return {
      id: String(user.id),
      username: user.username,
      displayName: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.first_name,
      profileUrl: user.username ? `https://t.me/${user.username}` : undefined,
    };
  }

  private buildStatusResult(input: {
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

  private toFailureStatus(error: unknown): SessionStatus {
    if (error instanceof AutoCliError) {
      return {
        state: "expired",
        message: error.message,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: error.code,
      };
    }

    if (error instanceof Error && /unauthorized|401/i.test(error.message)) {
      return {
        state: "expired",
        message: "Telegram returned an unauthorized response for the saved bot token.",
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: "UNAUTHORIZED",
      };
    }

    return {
      state: "unknown",
      message: error instanceof Error ? error.message : "Telegram bot token validation failed.",
      lastValidatedAt: new Date().toISOString(),
    };
  }

  private clampLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) {
      return 25;
    }

    return Math.min(Math.floor(limit), 100);
  }

  private summarizeChats(updates: TelegramBotUpdate[]): TelegramChatSummary[] {
    const byChatId = new Map<number, TelegramUpdateSummary>();

    for (const update of updates) {
      const summary = this.summarizeUpdate(update);
      if (!summary.chatId) {
        continue;
      }

      const current = byChatId.get(summary.chatId);
      if (!current || current.updateId < summary.updateId) {
        byChatId.set(summary.chatId, {
          ...summary,
          chatType: summary.chatType ?? "private",
        });
      }
    }

    return Array.from(byChatId.values())
      .sort((left, right) => right.updateId - left.updateId)
      .map((summary): TelegramChatSummary => ({
        id: summary.chatId ?? 0,
        type: summary.chatType ?? "private",
        title: summary.chatTitle,
        username: summary.chatUsername,
        name: summary.chatName,
        lastMessagePreview: summary.messagePreview,
        updateId: summary.updateId,
      }));
  }

  private summarizeUpdates(updates: TelegramBotUpdate[]): TelegramUpdateSummary[] {
    return updates.map((update) => this.summarizeUpdate(update));
  }

  private summarizeUpdate(update: TelegramBotUpdate): TelegramUpdateSummary {
    const message = update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post;
    const chat = message?.chat;
    const chatName = chat ? this.describeChat(chat) : undefined;
    return {
      updateId: update.update_id,
      kind: update.message
        ? "message"
        : update.edited_message
          ? "edited_message"
          : update.channel_post
            ? "channel_post"
            : update.edited_channel_post
              ? "edited_channel_post"
              : "unknown",
      chatId: chat?.id,
      chatType: chat?.type,
      chatName,
      chatTitle: chat?.title,
      chatUsername: chat?.username,
      messagePreview: this.previewMessage(message),
    };
  }

  private previewMessage(message?: TelegramBotMessage): string | undefined {
    if (!message) {
      return undefined;
    }

    const text = message.text ?? message.caption;
    if (!text) {
      return `message #${message.message_id}`;
    }

    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  }

  private describeChat(chat: TelegramBotChat): string {
    if (chat.username) {
      return `@${chat.username}`;
    }

    if (chat.title) {
      return chat.title;
    }

    const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim();
    return name || String(chat.id);
  }

  private async sendMedia(
    action: "send-photo" | "send-document" | "send-video" | "send-audio" | "send-voice",
    method: "sendPhoto" | "sendDocument" | "sendVideo" | "sendAudio" | "sendVoice",
    input: TelegramBotMediaInput,
  ): Promise<AdapterActionResult> {
    const loaded = await this.loadTelegramConnection(input.account);
    const message = await this.createApi(loaded.auth.token)[method]({
      chatId: input.chatId,
      media: input.media,
      caption: input.caption,
      parseMode: input.parseMode,
      replyToMessageId: input.replyToMessageId,
    });
    return this.messageResult(action, loaded.connection.account, loaded.path, message, `Telegram ${action} sent.`);
  }

  private messageResult(
    action: string,
    account: string,
    sessionPath: string,
    result: TelegramBotMessage | true,
    message: string,
  ): AdapterActionResult {
    if (result === true) {
      return {
        ok: true,
        platform: this.platform,
        account,
        action,
        message,
        sessionPath,
      };
    }

    return {
      ok: true,
      platform: this.platform,
      account,
      action,
      message,
      id: String(result.message_id),
      sessionPath,
      data: {
        message: result,
        chat: result.chat,
      },
    };
  }
}

export const telegrambotAdapter = new TelegramBotAdapter();

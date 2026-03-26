import { access, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { constants } from "node:fs";

import { AutoCliError } from "../../../../errors.js";

import type {
  TelegramBotApiErrorPayload,
  TelegramBotChat,
  TelegramBotMessage,
  TelegramBotUpdate,
  TelegramBotUser,
} from "./types.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface TelegramBotApiClient {
  getMe(): Promise<TelegramBotUser>;
  getUpdates(input?: TelegramGetUpdatesInput): Promise<TelegramBotUpdate[]>;
  getChat(chatId: string | number): Promise<TelegramBotChat>;
  sendMessage(input: TelegramSendMessageInput): Promise<TelegramBotMessage>;
  sendPhoto(input: TelegramSendMediaInput): Promise<TelegramBotMessage>;
  sendDocument(input: TelegramSendMediaInput): Promise<TelegramBotMessage>;
  sendVideo(input: TelegramSendMediaInput): Promise<TelegramBotMessage>;
  sendAudio(input: TelegramSendMediaInput): Promise<TelegramBotMessage>;
  sendVoice(input: TelegramSendMediaInput): Promise<TelegramBotMessage>;
  editMessageText(input: TelegramEditMessageInput): Promise<TelegramBotMessage | true>;
  editMessageCaption(input: TelegramEditMessageInput): Promise<TelegramBotMessage | true>;
  deleteMessage(input: TelegramDeleteMessageInput): Promise<true>;
}

export type TelegramFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface TelegramGetUpdatesInput {
  offset?: number;
  limit?: number;
  timeout?: number;
  allowedUpdates?: readonly string[];
}

export interface TelegramSendMessageInput {
  chatId: string | number;
  text: string;
  parseMode?: string;
  disableWebPagePreview?: boolean;
  replyToMessageId?: number;
}

export interface TelegramSendMediaInput {
  chatId: string | number;
  media: string;
  caption?: string;
  parseMode?: string;
  replyToMessageId?: number;
}

export interface TelegramEditMessageInput {
  chatId?: string | number;
  messageId?: number;
  inlineMessageId?: string;
  text: string;
  parseMode?: string;
  disableWebPagePreview?: boolean;
}

export interface TelegramDeleteMessageInput {
  chatId: string | number;
  messageId: number;
}

interface TelegramApiEnvelope<T> {
  ok: boolean;
  result?: T;
}

interface TelegramRequestOptions {
  method?: "GET" | "POST";
  params?: Record<string, unknown>;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}

export class TelegramBotApiError extends Error {
  readonly errorCode: number;
  readonly telegramDescription: string;

  constructor(
    message: string,
    errorCode: number,
    telegramDescription: string,
    public readonly method: string,
    public readonly parameters?: TelegramBotApiErrorPayload["parameters"],
  ) {
    super(message);
    this.name = "TelegramBotApiError";
    this.errorCode = errorCode;
    this.telegramDescription = telegramDescription;
  }
}

export class TelegramBotApi implements TelegramBotApiClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: TelegramFetch = globalThis.fetch.bind(globalThis),
  ) {}

  async getMe(): Promise<TelegramBotUser> {
    return this.request<TelegramBotUser>("getMe");
  }

  async getUpdates(input: TelegramGetUpdatesInput = {}): Promise<TelegramBotUpdate[]> {
    return this.request<TelegramBotUpdate[]>("getUpdates", {
      method: "GET",
      params: {
        offset: input.offset,
        limit: input.limit,
        timeout: input.timeout,
        allowed_updates: input.allowedUpdates?.length ? JSON.stringify([...input.allowedUpdates]) : undefined,
      },
    });
  }

  async getChat(chatId: string | number): Promise<TelegramBotChat> {
    return this.request<TelegramBotChat>("getChat", {
      method: "GET",
      params: {
        chat_id: chatId,
      },
    });
  }

  async sendMessage(input: TelegramSendMessageInput): Promise<TelegramBotMessage> {
    return this.request<TelegramBotMessage>("sendMessage", {
      method: "POST",
      params: {
        chat_id: input.chatId,
        text: input.text,
        parse_mode: input.parseMode,
        disable_web_page_preview: input.disableWebPagePreview,
        reply_to_message_id: input.replyToMessageId,
      },
    });
  }

  async sendPhoto(input: TelegramSendMediaInput): Promise<TelegramBotMessage> {
    return this.sendMedia("sendPhoto", "photo", input);
  }

  async sendDocument(input: TelegramSendMediaInput): Promise<TelegramBotMessage> {
    return this.sendMedia("sendDocument", "document", input);
  }

  async sendVideo(input: TelegramSendMediaInput): Promise<TelegramBotMessage> {
    return this.sendMedia("sendVideo", "video", input);
  }

  async sendAudio(input: TelegramSendMediaInput): Promise<TelegramBotMessage> {
    return this.sendMedia("sendAudio", "audio", input);
  }

  async sendVoice(input: TelegramSendMediaInput): Promise<TelegramBotMessage> {
    return this.sendMedia("sendVoice", "voice", input);
  }

  async editMessageText(input: TelegramEditMessageInput): Promise<TelegramBotMessage | true> {
    return this.request<TelegramBotMessage | true>("editMessageText", {
      method: "POST",
      params: {
        chat_id: input.chatId,
        message_id: input.messageId,
        inline_message_id: input.inlineMessageId,
        text: input.text,
        parse_mode: input.parseMode,
        disable_web_page_preview: input.disableWebPagePreview,
      },
    });
  }

  async editMessageCaption(input: TelegramEditMessageInput): Promise<TelegramBotMessage | true> {
    return this.request<TelegramBotMessage | true>("editMessageCaption", {
      method: "POST",
      params: {
        chat_id: input.chatId,
        message_id: input.messageId,
        inline_message_id: input.inlineMessageId,
        caption: input.text,
        parse_mode: input.parseMode,
      },
    });
  }

  async deleteMessage(input: TelegramDeleteMessageInput): Promise<true> {
    return this.request<true>("deleteMessage", {
      method: "POST",
      params: {
        chat_id: input.chatId,
        message_id: input.messageId,
      },
    });
  }

  private async sendMedia(
    method: "sendPhoto" | "sendDocument" | "sendVideo" | "sendAudio" | "sendVoice",
    fieldName: "photo" | "document" | "video" | "audio" | "voice",
    input: TelegramSendMediaInput,
  ): Promise<TelegramBotMessage> {
    const prepared = await this.resolveMediaInput(input.media);
    if (typeof prepared.mediaValue === "string") {
      return this.request<TelegramBotMessage>(method, {
        method: "POST",
        params: {
          chat_id: input.chatId,
          [fieldName]: prepared.mediaValue,
          caption: input.caption,
          parse_mode: input.parseMode,
          reply_to_message_id: input.replyToMessageId,
        },
      });
    }

    const form = new FormData();
    form.append("chat_id", String(input.chatId));
    form.append(fieldName, prepared.mediaValue, prepared.fileName ?? basename(input.media));
    this.appendOptional(form, "caption", input.caption);
    this.appendOptional(form, "parse_mode", input.parseMode);
    this.appendOptional(form, "reply_to_message_id", input.replyToMessageId);

    return this.request<TelegramBotMessage>(method, {
      method: "POST",
      body: form,
    });
  }

  private async resolveMediaInput(value: string): Promise<{ mediaValue: string | File; fileName?: string }> {
    const trimmed = value.trim();
    if (this.looksLikeUrl(trimmed)) {
      return { mediaValue: trimmed };
    }

    const exists = await access(trimmed, constants.R_OK)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return { mediaValue: trimmed };
    }

    const bytes = await readFile(trimmed);
    return {
      mediaValue: new File([bytes], basename(trimmed)),
      fileName: basename(trimmed),
    };
  }

  private async request<T>(method: string, options: TelegramRequestOptions = {}): Promise<T> {
    const requestMethod = options.method ?? "POST";
    const url = new URL(`${TELEGRAM_API_BASE}/bot${this.token}/${method}`);
    const headers = new Headers(options.headers);
    let body: BodyInit | null | undefined = options.body;

    if (options.params) {
      const entries = Object.entries(options.params).filter(([, value]) => value !== undefined && value !== null);

      if (requestMethod === "GET") {
        for (const [key, value] of entries) {
          url.searchParams.set(key, this.serializeParam(value));
        }
      } else if (!body) {
        const form = new URLSearchParams();
        for (const [key, value] of entries) {
          form.set(key, this.serializeParam(value));
        }
        body = form;
      } else if (body instanceof FormData) {
        for (const [key, value] of entries) {
          body.append(key, this.serializeParam(value));
        }
      }
    }

    const response = await this.fetchImpl(url, {
      method: requestMethod,
      headers,
      body,
    });

    const rawText = await response.text();
    const parsed = this.parseJson(rawText);

    if (!response.ok) {
      const description = this.extractErrorDescription(parsed) ?? `Telegram API request failed with HTTP ${response.status}.`;
      const errorCode = this.extractErrorCode(parsed) ?? response.status;
      throw new TelegramBotApiError(
        `Telegram API ${method} failed: ${description}`,
        errorCode,
        description,
        method,
        this.extractErrorParameters(parsed),
      );
    }

    if (!this.isEnvelope(parsed) || parsed.ok !== true || !("result" in parsed)) {
      throw new TelegramBotApiError(
        `Telegram API ${method} returned an unexpected payload.`,
        response.status,
        "Unexpected Telegram API response.",
        method,
      );
    }

    return parsed.result as T;
  }

  private serializeParam(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return JSON.stringify(value);
  }

  private parseJson(rawText: string): unknown {
    if (!rawText.trim()) {
      return null;
    }

    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  }

  private isEnvelope(value: unknown): value is TelegramApiEnvelope<unknown> {
    return value !== null && typeof value === "object" && "ok" in value;
  }

  private extractErrorDescription(value: unknown): string | undefined {
    if (this.isTelegramErrorPayload(value)) {
      return value.description;
    }

    return undefined;
  }

  private extractErrorCode(value: unknown): number | undefined {
    if (this.isTelegramErrorPayload(value)) {
      return value.error_code;
    }

    return undefined;
  }

  private extractErrorParameters(value: unknown): TelegramBotApiErrorPayload["parameters"] | undefined {
    if (this.isTelegramErrorPayload(value)) {
      return value.parameters;
    }

    return undefined;
  }

  private isTelegramErrorPayload(value: unknown): value is TelegramBotApiErrorPayload {
    if (!value || typeof value !== "object") {
      return false;
    }

    const payload = value as Record<string, unknown>;
    return payload.ok === false && typeof payload.error_code === "number" && typeof payload.description === "string";
  }

  private looksLikeUrl(value: string): boolean {
    return /^https?:\/\//iu.test(value);
  }

  private appendOptional(form: FormData, key: string, value: string | number | boolean | undefined): void {
    if (value === undefined) {
      return;
    }

    form.append(key, String(value));
  }
}

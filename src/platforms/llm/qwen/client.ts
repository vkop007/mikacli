import { randomUUID } from "node:crypto";

import { MikaCliError, isMikaCliError } from "../../../errors.js";

import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus } from "../../../types.js";

const QWEN_HOME_URL = "https://chat.qwen.ai/";
const QWEN_API_BASE_URL = "https://chat.qwen.ai";
const QWEN_CHAT_CREATE_PATH = "/api/v1/chats/new";
const QWEN_CHAT_COMPLETIONS_PATH = "/api/v2/chat/completions";
const QWEN_DEFAULT_MODEL = "qwen-max-latest";
const QWEN_CLIENT_VERSION = "0.2.16";
const QWEN_CHAT_MODE = "normal";
const QWEN_TEXT_CHAT_TYPE = "t2t";
const QWEN_AUTH_COOKIE_NAMES = ["token", "accessToken", "authToken"] as const;
const QWEN_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface QwenApiEnvelope {
  message?: string;
  error?: string;
  detail?: string | { message?: string };
  code?: number | string;
  choices?: unknown;
}

interface QwenChatRecord {
  id?: string;
}

interface QwenStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      extra?: {
        web_search_info?: unknown[];
      };
    };
  }>;
  model?: string;
}

export interface QwenSearchResult {
  url?: string;
  title?: string;
  snippet?: string;
  hostname?: string;
  date?: string;
}

export interface QwenInspectionResult {
  status: SessionStatus;
  defaultModel: string;
}

export interface QwenTextExecutionResult {
  outputText: string;
  model: string;
  searchResults: QwenSearchResult[];
}

interface QwenParsedCompletion {
  outputText: string;
  model?: string;
  searchResults: QwenSearchResult[];
}

export class QwenWebClient {
  constructor(
    private readonly client: SessionHttpClient,
    private readonly explicitToken?: string,
  ) {}

  async inspectSession(): Promise<QwenInspectionResult> {
    try {
      const token = await this.resolveAuthToken();
      await this.createChat(token);

      return {
        status: {
          state: "active",
          message: "Qwen session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        defaultModel: QWEN_DEFAULT_MODEL,
      };
    } catch (error) {
      if (isMikaCliError(error)) {
        return mapQwenSessionInspectionError(error);
      }

      return {
        status: {
          state: "unknown",
          message: error instanceof Error ? error.message : "Qwen session inspection failed.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: error instanceof Error ? "QWEN_SESSION_CHECK_FAILED" : "QWEN_SESSION_CHECK_FAILED",
        },
        defaultModel: QWEN_DEFAULT_MODEL,
      };
    }
  }

  async executeText(input: {
    prompt: string;
    model?: string;
  }): Promise<QwenTextExecutionResult> {
    try {
      const token = await this.resolveAuthToken();
      const requestedModel = resolveQwenModel(input.model);
      const chat = await this.createChat(token);
      const raw = await this.requestText(
        `${QWEN_CHAT_COMPLETIONS_PATH}?chat_id=${encodeURIComponent(chat.id)}`,
        {
          method: "POST",
          token,
          body: JSON.stringify(buildQwenPayload(input.prompt, requestedModel, chat.id)),
          requestId: randomUUID(),
          stream: true,
        },
      );

      const parsedJson = parseQwenJson(raw);
      if (isQwenLogicalError(parsedJson)) {
        throw toQwenRequestError(parsedJson, `${QWEN_API_BASE_URL}${QWEN_CHAT_COMPLETIONS_PATH}`);
      }

      const parsed = parseQwenCompletionStream(raw);
      if (!parsed.outputText) {
        throw new MikaCliError("QWEN_EMPTY_RESPONSE", "Qwen returned an empty response.", {
          details: {
            model: parsed.model ?? requestedModel,
          },
        });
      }

      return {
        outputText: parsed.outputText,
        model: parsed.model ?? requestedModel,
        searchResults: parsed.searchResults,
      };
    } catch (error) {
      throw mapQwenError(error, "Failed to complete the Qwen prompt.");
    }
  }

  private async createChat(token: string): Promise<{ id: string }> {
    const created = await this.requestJson<QwenChatRecord>(QWEN_CHAT_CREATE_PATH, {
      method: "POST",
      token,
      body: JSON.stringify({
        chat: buildQwenChatPayload(),
      }),
      expectedStatus: [200, 201],
      requestId: randomUUID(),
    });

    if (!created.id) {
      throw new MikaCliError("QWEN_CHAT_CREATE_FAILED", "Qwen did not return a chat id.", {
        details: {
          response: created,
        },
      });
    }

    return {
      id: created.id,
    };
  }

  private async requestJson<T>(
    path: string,
    input: {
      token?: string;
      body?: BodyInit | string;
      method?: string;
      expectedStatus?: number | number[];
      requestId?: string;
    } = {},
  ): Promise<T> {
    return this.client.request<T>(`${QWEN_API_BASE_URL}${path}`, {
      method: input.method ?? "GET",
      body: input.body,
      responseType: "json",
      expectedStatus: input.expectedStatus ?? 200,
      headers: buildQwenHeaders({
        token: input.token,
        hasBody: typeof input.body !== "undefined",
        requestId: input.requestId,
      }),
    });
  }

  private async requestText(
    path: string,
    input: {
      token?: string;
      body?: BodyInit | string;
      method?: string;
      expectedStatus?: number | number[];
      requestId?: string;
      stream?: boolean;
    } = {},
  ): Promise<string> {
    return this.client.request<string>(`${QWEN_API_BASE_URL}${path}`, {
      method: input.method ?? "GET",
      body: input.body,
      responseType: "text",
      expectedStatus: input.expectedStatus ?? 200,
      headers: buildQwenHeaders({
        token: input.token,
        hasBody: typeof input.body !== "undefined",
        requestId: input.requestId,
        stream: input.stream,
      }),
    });
  }

  private async resolveAuthToken(): Promise<string> {
    if (typeof this.explicitToken === "string" && this.explicitToken.trim().length > 0) {
      return normalizeQwenAuthToken(this.explicitToken);
    }

    return extractQwenAuthToken(this.client);
  }
}

export async function extractQwenAuthToken(client: SessionHttpClient): Promise<string> {
  const cookies = await client.jar.getCookies(QWEN_HOME_URL);
  for (const name of QWEN_AUTH_COOKIE_NAMES) {
    const cookie = cookies.find((candidate) => candidate.key === name && candidate.value.trim().length > 0);
    if (cookie) {
      return normalizeQwenAuthToken(cookie.value);
    }
  }

  throw new MikaCliError(
    "QWEN_AUTH_TOKEN_MISSING",
    "Qwen needs an auth token. If your cookie export already includes the `token` cookie, no extra flag is needed. Otherwise pass the bearer token once with --token.",
    {
      details: {
        expectedCookieNames: QWEN_AUTH_COOKIE_NAMES,
        cookieNames: cookies.map((cookie) => cookie.key),
      },
    },
  );
}

export function normalizeQwenAuthToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new MikaCliError("QWEN_AUTH_TOKEN_MISSING", "Qwen auth token is empty.");
  }

  return trimmed.replace(/^Bearer\s+/iu, "").trim().replace(/^"|"$/gu, "");
}

export function parseQwenCompletionStream(stream: string): QwenParsedCompletion {
  const outputParts: string[] = [];
  const searchResults: QwenSearchResult[] = [];
  const seenSearchKeys = new Set<string>();
  let model: string | undefined;

  for (const line of stream.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const raw = trimmed.slice(5).trim();
    if (!raw || raw === "[DONE]") {
      continue;
    }

    let chunk: QwenStreamChunk;
    try {
      chunk = JSON.parse(raw) as QwenStreamChunk;
    } catch {
      continue;
    }

    if (!model && typeof chunk.model === "string" && chunk.model.length > 0) {
      model = chunk.model;
    }

    const delta = chunk.choices?.[0]?.delta;
    const content = delta?.content;
    if (typeof content === "string" && content.length > 0) {
      outputParts.push(content);
    }

    const rawSearchResults = Array.isArray(delta?.extra?.web_search_info) ? delta.extra.web_search_info : [];
    for (const candidate of rawSearchResults) {
      const mapped = mapQwenSearchResult(candidate);
      if (!mapped) {
        continue;
      }

      const dedupeKey = `${mapped.url ?? ""}::${mapped.title ?? ""}::${mapped.snippet ?? ""}`;
      if (seenSearchKeys.has(dedupeKey)) {
        continue;
      }

      seenSearchKeys.add(dedupeKey);
      searchResults.push(mapped);
    }
  }

  return {
    outputText: outputParts.join(""),
    model,
    searchResults,
  };
}

export function mapQwenError(error: unknown, fallbackMessage: string): MikaCliError {
  if (isMikaCliError(error)) {
    if (error.code === "QWEN_AUTH_TOKEN_MISSING") {
      return new MikaCliError(
        "QWEN_SESSION_EXPIRED",
        "Qwen needs an auth token. If your cookie export already includes the `token` cookie, no extra flag is needed. Otherwise re-import cookies and pass the bearer token with `--token`.",
        {
          details: error.details,
        },
      );
    }

    if (error.code === "HTTP_REQUEST_FAILED") {
      const status = Number(error.details?.status);
      if (status === 401 || status === 403) {
        return new MikaCliError("QWEN_SESSION_EXPIRED", "Qwen session expired. Re-import cookies and token.", {
          details: error.details,
        });
      }

      if (status === 429) {
        return new MikaCliError("QWEN_RATE_LIMITED", "Qwen rate limit reached. Try again later.", {
          details: error.details,
        });
      }

      if (status === 504) {
        return new MikaCliError(
          "QWEN_UPSTREAM_TIMEOUT",
          "Qwen accepted the session, but the generation request timed out upstream. Try again in a moment.",
          {
            details: error.details,
          },
        );
      }
    }

    if (error.code === "QWEN_API_REQUEST_FAILED") {
      const message = String(error.details?.message ?? error.message).toLowerCase();
      if (message.includes("login") || message.includes("unauthorized") || message.includes("forbidden")) {
        return new MikaCliError("QWEN_SESSION_EXPIRED", "Qwen session expired. Re-import cookies and token.", {
          details: error.details,
        });
      }
    }

    return error;
  }

  if (error instanceof Error) {
    return new MikaCliError("QWEN_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details: {
        message: error.message,
      },
    });
  }

  return new MikaCliError("QWEN_REQUEST_FAILED", fallbackMessage);
}

function buildQwenHeaders(input: {
  token?: string;
  hasBody?: boolean;
  requestId?: string;
  stream?: boolean;
} = {}): Record<string, string> {
  const headers: Record<string, string> = {
    accept: input.stream ? "text/event-stream" : "application/json",
    authorization: `Bearer ${normalizeQwenAuthToken(input.token ?? "")}`,
    origin: "https://chat.qwen.ai",
    referer: "https://chat.qwen.ai/",
    source: "web",
    timezone: new Date().toString().replace(/\s*\(.+\)$/u, ""),
    "user-agent": QWEN_USER_AGENT,
    version: QWEN_CLIENT_VERSION,
    "x-request-id": input.requestId ?? randomUUID(),
  };

  if (input.hasBody) {
    headers["content-type"] = "application/json";
  }

  if (input.stream) {
    headers["x-accel-buffering"] = "no";
  }

  return headers;
}

function buildQwenChatPayload(): Record<string, unknown> {
  return {
    title: "New Chat",
    chat_mode: QWEN_CHAT_MODE,
    chat_type: QWEN_TEXT_CHAT_TYPE,
    timestamp: Date.now(),
  };
}

function buildQwenPayload(prompt: string, model: string, chatId: string): Record<string, unknown> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    stream: true,
    version: "2.1",
    incremental_output: true,
    chat_id: chatId,
    chat_mode: QWEN_CHAT_MODE,
    model,
    parent_id: null,
    messages: [
      {
        fid: randomUUID(),
        parentId: null,
        parent_id: null,
        childrenIds: [],
        role: "user",
        content: prompt,
        timestamp: nowSeconds,
        models: [],
        chat_type: QWEN_TEXT_CHAT_TYPE,
        feature_config: {
          thinking_enabled: false,
          auto_search: false,
          thinking_budget: 0,
          output_schema: "phase",
        },
        sub_chat_type: QWEN_TEXT_CHAT_TYPE,
      },
    ],
    timestamp: nowSeconds,
  };
}

function resolveQwenModel(model?: string): string {
  return typeof model === "string" && model.trim().length > 0 ? model.trim() : QWEN_DEFAULT_MODEL;
}

function parseQwenJson(value: string): QwenApiEnvelope | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as QwenApiEnvelope;
  } catch {
    return null;
  }
}

function isQwenLogicalError(parsed: QwenApiEnvelope | null): parsed is QwenApiEnvelope {
  if (!parsed || typeof parsed !== "object") {
    return false;
  }

  if (Array.isArray(parsed.choices)) {
    return false;
  }

  return Boolean(readString(parsed.message, parsed.error, pickObject(parsed.detail)?.message));
}

function toQwenRequestError(parsed: QwenApiEnvelope, url: string): MikaCliError {
  const message = readString(parsed.message, parsed.error, pickObject(parsed.detail)?.message)
    ?? "Qwen request failed.";

  return new MikaCliError("QWEN_API_REQUEST_FAILED", message, {
    details: {
      url,
      code: parsed.code,
      message,
    },
  });
}

function mapQwenSessionInspectionError(error: MikaCliError): QwenInspectionResult {
  if (error.code === "QWEN_AUTH_TOKEN_MISSING" || error.code === "QWEN_SESSION_EXPIRED") {
    return {
      status: {
        state: "expired",
        message: "Qwen needs an auth token. If your cookie export already includes the `token` cookie, no extra flag is needed. Otherwise re-import cookies and pass the bearer token with `--token`.",
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: error.code,
      },
      defaultModel: QWEN_DEFAULT_MODEL,
    };
  }

  if (error.code === "QWEN_RATE_LIMITED") {
    return {
      status: {
        state: "unknown",
        message: error.message,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: error.code,
      },
      defaultModel: QWEN_DEFAULT_MODEL,
    };
  }

  return {
    status: {
      state: "unknown",
      message: error.message,
      lastValidatedAt: new Date().toISOString(),
      lastErrorCode: error.code,
    },
    defaultModel: QWEN_DEFAULT_MODEL,
  };
}

function mapQwenSearchResult(value: unknown): QwenSearchResult | undefined {
  const object = pickObject(value);
  if (!object) {
    return undefined;
  }

  const result: QwenSearchResult = {
    url: readString(object.url),
    title: readString(object.title),
    snippet: readString(object.snippet),
    hostname: readString(object.hostname),
    date: readString(object.date),
  };

  if (!result.url && !result.title && !result.snippet) {
    return undefined;
  }

  return result;
}

function pickObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

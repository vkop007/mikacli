import { AutoCliError, isAutoCliError } from "../../../errors.js";
import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus, SessionUser } from "../../../types.js";
import { DeepSeekPowSolver, type DeepSeekPowChallenge } from "./pow.js";

const DEEPSEEK_HOME_URL = "https://chat.deepseek.com/";
const DEEPSEEK_SIGN_IN_URL = "https://chat.deepseek.com/sign_in";
const DEEPSEEK_API_URL = "https://chat.deepseek.com/api/v0";
const DEEPSEEK_CHAT_URL = "https://chat.deepseek.com/a/chat/s";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const DEEPSEEK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0";
const DEEPSEEK_ACCEPT_LANGUAGE = "en-US,en;q=0.9,vi;q=0.8";
const DEEPSEEK_AUTH_COOKIE_NAMES = ["auth_token", "userToken", "token", "authToken"] as const;

interface DeepSeekApiEnvelope {
  code?: number;
  msg?: string;
  data?: unknown;
}

interface DeepSeekCurrentUserResponse extends DeepSeekApiEnvelope {
  data?:
    | {
        user?: unknown;
        id?: string;
        name?: string;
        username?: string;
        email?: string;
        display_name?: string;
        displayName?: string;
        avatar_url?: string;
        avatarUrl?: string;
      }
    | undefined;
}

interface DeepSeekChatSessionCreateResponse extends DeepSeekApiEnvelope {
  data?: {
    biz_data?: {
      id?: string;
    };
  };
}

interface DeepSeekPowChallengeResponse extends DeepSeekApiEnvelope {
  data?: {
    biz_data?: {
      challenge?: DeepSeekPowChallenge;
    };
  };
}

export interface DeepSeekInspectionResult {
  status: SessionStatus;
  user?: SessionUser;
  defaultModel?: string;
}

export interface DeepSeekTextExecutionResult {
  outputText: string;
  thinkingText: string[];
  chatSessionId: string;
  messageId?: string;
  model: string;
}

interface DeepSeekCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      type?: string;
    };
    finish_reason?: string | null;
  }>;
  p?: string;
  o?: string;
  v?: unknown;
  model?: string;
  message_id?: number | string;
  parent_id?: number | string;
}

interface DeepSeekCompletionParseResult {
  outputText: string;
  thinkingText: string[];
  messageId?: string;
  model?: string;
}

export class DeepSeekWebClient {
  private readonly powSolver = new DeepSeekPowSolver();

  constructor(
    private readonly client: SessionHttpClient,
    private readonly explicitToken?: string,
  ) {}

  async inspectSession(): Promise<DeepSeekInspectionResult> {
    try {
      const token = await this.resolveAuthToken();
      const response = await this.requestJson<DeepSeekCurrentUserResponse>("/users/current", {
        token,
        referer: DEEPSEEK_SIGN_IN_URL,
      });

      return {
        status: {
          state: "active",
          message: "DeepSeek session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: extractDeepSeekSessionUser(response),
        defaultModel: DEEPSEEK_DEFAULT_MODEL,
      };
    } catch (error) {
      if (isAutoCliError(error)) {
        return mapDeepSeekSessionInspectionError(error);
      }

      return {
        status: {
          state: "unknown",
          message: error instanceof Error ? error.message : "DeepSeek session inspection failed.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: error instanceof Error ? "DEEPSEEK_SESSION_CHECK_FAILED" : "DEEPSEEK_SESSION_CHECK_FAILED",
        },
      };
    }
  }

  async executeText(input: {
    prompt: string;
    model?: string;
    thinkingEnabled?: boolean;
    searchEnabled?: boolean;
  }): Promise<DeepSeekTextExecutionResult> {
    try {
      const token = await this.resolveAuthToken();
      const chatSessionId = await this.createChatSession(token);
      const powResponse = await this.createPowResponse(token, "/api/v0/chat/completion");
      const stream = await this.requestText("/chat/completion", {
        method: "POST",
        token,
        referer: `${DEEPSEEK_CHAT_URL}/${chatSessionId}`,
        extraHeaders: {
          "x-ds-pow-response": powResponse,
        },
        body: JSON.stringify({
          chat_session_id: chatSessionId,
          parent_message_id: null,
          prompt: input.prompt,
          ref_file_ids: [],
          thinking_enabled: input.thinkingEnabled ?? false,
          search_enabled: input.searchEnabled ?? false,
        }),
      });

      const error = parseDeepSeekJson(stream);
      if (isDeepSeekLogicalError(error)) {
        throw toDeepSeekRequestError(error, `${DEEPSEEK_API_URL}/chat/completion`);
      }

      const parsed = parseDeepSeekCompletionStream(stream);
      if (!parsed.outputText) {
        throw new AutoCliError("DEEPSEEK_EMPTY_RESPONSE", "DeepSeek returned an empty response.");
      }

      return {
        outputText: parsed.outputText,
        thinkingText: parsed.thinkingText,
        chatSessionId,
        messageId: parsed.messageId,
        model: input.model?.trim() || parsed.model || DEEPSEEK_DEFAULT_MODEL,
      };
    } catch (error) {
      throw mapDeepSeekError(error, "Failed to complete the DeepSeek prompt.");
    }
  }

  private async createChatSession(token: string): Promise<string> {
    const response = await this.requestJson<DeepSeekChatSessionCreateResponse>("/chat_session/create", {
      method: "POST",
      token,
      referer: DEEPSEEK_SIGN_IN_URL,
      body: JSON.stringify({
        character_id: null,
      }),
    });

    const chatSessionId = response.data?.biz_data?.id;
    if (typeof chatSessionId !== "string" || chatSessionId.length === 0) {
      throw new AutoCliError("DEEPSEEK_CHAT_SESSION_CREATE_FAILED", "DeepSeek did not return a chat session id.");
    }

    return chatSessionId;
  }

  private async createPowResponse(token: string, targetPath: string): Promise<string> {
    const response = await this.requestJson<DeepSeekPowChallengeResponse>("/chat/create_pow_challenge", {
      method: "POST",
      token,
      referer: DEEPSEEK_SIGN_IN_URL,
      body: JSON.stringify({
        target_path: targetPath,
      }),
    });

    const challenge = response.data?.biz_data?.challenge;
    if (!challenge) {
      throw new AutoCliError("DEEPSEEK_POW_CHALLENGE_MISSING", "DeepSeek did not return a PoW challenge.");
    }

    return this.powSolver.solve(challenge);
  }

  private async requestJson<T>(
    path: string,
    input: {
      token?: string;
      body?: BodyInit | string;
      method?: string;
      referer?: string;
      extraHeaders?: Record<string, string>;
      expectedStatus?: number | number[];
    } = {},
  ): Promise<T> {
    const raw = await this.requestText(path, input);
    const parsed = parseDeepSeekJson(raw);

    if (!parsed || typeof parsed !== "object") {
      throw new AutoCliError("DEEPSEEK_INVALID_RESPONSE", "DeepSeek returned a non-JSON response.", {
        details: {
          url: `${DEEPSEEK_API_URL}${path}`,
          preview: raw.slice(0, 200),
        },
      });
    }

    if (isDeepSeekLogicalError(parsed)) {
      throw toDeepSeekRequestError(parsed, `${DEEPSEEK_API_URL}${path}`);
    }

    return parsed as T;
  }

  private async requestText(
    path: string,
    input: {
      token?: string;
      body?: BodyInit | string;
      method?: string;
      referer?: string;
      extraHeaders?: Record<string, string>;
      expectedStatus?: number | number[];
    } = {},
  ): Promise<string> {
    return this.client.request<string>(`${DEEPSEEK_API_URL}${path}`, {
      method: input.method ?? "GET",
      body: input.body,
      responseType: "text",
      expectedStatus: input.expectedStatus ?? 200,
      headers: buildDeepSeekHeaders({
        token: input.token,
        referer: input.referer,
        extraHeaders: input.extraHeaders,
        hasBody: typeof input.body !== "undefined",
      }),
    });
  }

  private async resolveAuthToken(): Promise<string> {
    if (typeof this.explicitToken === "string" && this.explicitToken.trim().length > 0) {
      return normalizeDeepSeekAuthToken(this.explicitToken);
    }

    return extractDeepSeekAuthToken(this.client);
  }
}

export async function extractDeepSeekAuthToken(client: SessionHttpClient): Promise<string> {
  const cookies = await client.jar.getCookies(DEEPSEEK_HOME_URL);
  for (const name of DEEPSEEK_AUTH_COOKIE_NAMES) {
    const cookie = cookies.find((candidate) => candidate.key === name && candidate.value.trim().length > 0);
    if (cookie) {
      return normalizeDeepSeekAuthToken(cookie.value);
    }
  }

  throw new AutoCliError("DEEPSEEK_AUTH_TOKEN_MISSING", "DeepSeek session is missing an auth token cookie. Re-export cookies from a logged-in browser session.", {
    details: {
      expectedCookieNames: DEEPSEEK_AUTH_COOKIE_NAMES,
      cookieNames: cookies.map((cookie) => cookie.key),
    },
  });
}

export function normalizeDeepSeekAuthToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new AutoCliError("DEEPSEEK_AUTH_TOKEN_MISSING", "DeepSeek auth token is empty.");
  }

  return trimmed.replace(/^Bearer\s+/iu, "").trim().replace(/^"|"$/gu, "");
}

export function parseDeepSeekCompletionStream(stream: string): DeepSeekCompletionParseResult {
  const outputParts: string[] = [];
  const thinkingParts: string[] = [];
  let messageId: string | undefined;
  let model: string | undefined;
  let activeSection: "output" | "thinking" | undefined;

  for (const line of stream.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const raw = trimmed.slice(5).trim();
    if (!raw || raw === "[DONE]") {
      continue;
    }

    let chunk: DeepSeekCompletionChunk;
    try {
      chunk = JSON.parse(raw) as DeepSeekCompletionChunk;
    } catch {
      continue;
    }

    if (typeof chunk.model === "string" && chunk.model.length > 0 && !model) {
      model = chunk.model;
    }

    if (typeof chunk.message_id !== "undefined" && !messageId) {
      messageId = String(chunk.message_id);
    }

    const nestedResponse = pickObject(pickObject(chunk.v)?.response);
    if (nestedResponse) {
      if (!messageId && typeof nestedResponse["message_id"] !== "undefined") {
        messageId = String(nestedResponse["message_id"]);
      }

      if (!model && typeof nestedResponse["model"] === "string" && nestedResponse["model"].length > 0) {
        model = nestedResponse["model"];
      }
    }

    const choice = chunk.choices?.[0];
    const delta = choice?.delta;
    const content = delta?.content ?? "";
    if (content.trim().length > 0) {
      const type = delta?.type?.trim().toLowerCase() ?? "";
      if (type === "thinking") {
        thinkingParts.push(content);
      } else {
        outputParts.push(content);
      }
      if (!activeSection) {
        activeSection = type === "thinking" ? "thinking" : "output";
      }
    }

    if (chunk.p === "response/content" || chunk.p === "response/thinking_content") {
      activeSection = chunk.p === "response/thinking_content" ? "thinking" : "output";

      if (typeof chunk.v === "string" && chunk.v.length > 0) {
        if (activeSection === "thinking") {
          thinkingParts.push(chunk.v);
        } else {
          outputParts.push(chunk.v);
        }
      }
      continue;
    }

    if (chunk.p) {
      continue;
    }

    if (typeof chunk.v === "string" && chunk.v.length > 0 && activeSection) {
      if (activeSection === "thinking") {
        thinkingParts.push(chunk.v);
      } else {
        outputParts.push(chunk.v);
      }
      continue;
    }

    if (choice?.finish_reason === "stop") {
      break;
    }
  }

  return {
    outputText: outputParts.join(""),
    thinkingText: thinkingParts,
    messageId,
    model,
  };
}

export function mapDeepSeekError(error: unknown, fallbackMessage: string): AutoCliError {
  if (isAutoCliError(error)) {
    if (error.code === "DEEPSEEK_AUTH_TOKEN_MISSING") {
      return new AutoCliError(
        "DEEPSEEK_SESSION_EXPIRED",
        "DeepSeek needs the browser localStorage `userToken`, not just cookies. Export the token from a logged-in session and pass it with `--token`.",
        {
        details: error.details,
        },
      );
    }

    if (error.code === "HTTP_REQUEST_FAILED") {
      const status = Number(error.details?.status);
      if (status === 401 || status === 403) {
        return new AutoCliError("DEEPSEEK_SESSION_EXPIRED", "DeepSeek session expired. Re-import cookies.", {
          details: error.details,
        });
      }

      if (status === 429) {
        return new AutoCliError("DEEPSEEK_RATE_LIMITED", "DeepSeek rate limit reached. Try again later.", {
          details: error.details,
        });
      }
    }

    if (error.code === "DEEPSEEK_API_REQUEST_FAILED") {
      const code = Number(error.details?.code);
      if (code === 40002 || code === 40003) {
        return new AutoCliError("DEEPSEEK_SESSION_EXPIRED", "DeepSeek session expired. Re-import cookies.", {
          details: error.details,
        });
      }

      if (code === 429) {
        return new AutoCliError("DEEPSEEK_RATE_LIMITED", "DeepSeek rate limit reached. Try again later.", {
          details: error.details,
        });
      }
    }

    return error;
  }

  if (error instanceof Error) {
    return new AutoCliError("DEEPSEEK_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details: {
        message: error.message,
      },
    });
  }

  return new AutoCliError("DEEPSEEK_REQUEST_FAILED", fallbackMessage);
}

function buildDeepSeekHeaders(input: {
  token?: string;
  referer?: string;
  extraHeaders?: Record<string, string>;
  hasBody?: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-language": DEEPSEEK_ACCEPT_LANGUAGE,
    dnt: "1",
    origin: "https://chat.deepseek.com",
    priority: "u=1, i",
    referer: input.referer ?? DEEPSEEK_SIGN_IN_URL,
    "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Microsoft Edge";v="132"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": DEEPSEEK_USER_AGENT,
    "x-app-version": "20241129.1",
    "x-client-locale": "en_US",
    "x-client-platform": "web",
    "x-client-version": "1.0.0-always",
  };

  if (input.hasBody) {
    headers["content-type"] = "application/json";
  }

  if (input.token) {
    headers.authorization = `Bearer ${normalizeDeepSeekAuthToken(input.token)}`;
  }

  return {
    ...headers,
    ...(input.extraHeaders ?? {}),
  };
}

function extractDeepSeekSessionUser(response: DeepSeekCurrentUserResponse): SessionUser | undefined {
  const candidates = [response.data, (response.data as { user?: unknown } | undefined)?.user];

  for (const candidate of candidates) {
    const object = pickObject(candidate);
    if (!object) {
      continue;
    }

    const id = readString(object.id);
    const username = readString(
      object.username,
      object.name,
      object.display_name,
      object.displayName,
      object.email,
    );
    const displayName = readString(object.displayName, object.display_name, object.name, object.username);
    const profileUrl = readString(object.avatar_url, object.avatarUrl);

    if (id || username || displayName || profileUrl) {
      return {
        id,
        username,
        displayName,
        profileUrl,
      };
    }
  }

  return undefined;
}

function mapDeepSeekSessionInspectionError(error: AutoCliError): DeepSeekInspectionResult {
  if (error.code === "DEEPSEEK_AUTH_TOKEN_MISSING" || error.code === "DEEPSEEK_SESSION_EXPIRED") {
    return {
      status: {
        state: "expired",
        message: "DeepSeek needs the browser localStorage `userToken`, not just cookies. Export the token from a logged-in session and pass it with `--token`.",
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: error.code,
      },
    };
  }

  if (error.code === "DEEPSEEK_RATE_LIMITED") {
    return {
      status: {
        state: "unknown",
        message: error.message,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: error.code,
      },
    };
  }

  return {
    status: {
      state: "unknown",
      message: error.message,
      lastValidatedAt: new Date().toISOString(),
      lastErrorCode: error.code,
    },
  };
}

function parseDeepSeekJson(value: string): DeepSeekApiEnvelope | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as DeepSeekApiEnvelope;
  } catch {
    return null;
  }
}

function isDeepSeekLogicalError(parsed: DeepSeekApiEnvelope | null): parsed is DeepSeekApiEnvelope {
  return Boolean(parsed && typeof parsed === "object" && typeof parsed.code === "number" && parsed.code !== 0);
}

function toDeepSeekRequestError(parsed: DeepSeekApiEnvelope, url: string): AutoCliError {
  const code = Number(parsed.code);
  const message = parsed.msg || `DeepSeek request failed with code ${code}.`;

  return new AutoCliError("DEEPSEEK_API_REQUEST_FAILED", message, {
    details: {
      url,
      code,
      message: parsed.msg,
    },
  });
}

function pickObject(...candidates: unknown[]): Record<string, unknown> | undefined {
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
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

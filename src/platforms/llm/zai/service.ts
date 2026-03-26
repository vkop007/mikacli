import { createHmac, randomUUID } from "node:crypto";

import { AutoCliError, isAutoCliError } from "../../../errors.js";
import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus, SessionUser } from "../../../types.js";

const ZAI_HOME_URL = "https://chat.z.ai/";
const ZAI_AUTH_URL = "https://chat.z.ai/api/v1/auths/";
const ZAI_CONFIG_URL = "https://chat.z.ai/api/config";
const ZAI_NEW_CHAT_URL = "https://chat.z.ai/api/v1/chats/new";
const ZAI_CHAT_COMPLETIONS_URL = "https://chat.z.ai/api/v2/chat/completions";

const ZAI_PLATFORM = "web";
const ZAI_VERSION = "0.0.1";
const ZAI_ACCEPT_LANGUAGE = "en-US";
const ZAI_LANGUAGE_LIST = "en-US,en";
const ZAI_DEFAULT_MODEL = "glm-5";
const ZAI_DEFAULT_FE_VERSION = "prod-fe-1.0.275";
const ZAI_SIGNATURE_SECRET = "key-@@@@)))()((9))-xxxx&&&%%%%%";
const ZAI_BROWSER_NAME = "Chrome";
const ZAI_SCREEN_WIDTH = "1728";
const ZAI_SCREEN_HEIGHT = "1117";
const ZAI_VIEWPORT_WIDTH = "1728";
const ZAI_VIEWPORT_HEIGHT = "1018";
const ZAI_PIXEL_RATIO = "2";
const ZAI_COLOR_DEPTH = "24";

interface ZaiAuthResponse {
  id?: string;
  email?: string;
  name?: string;
  token?: string;
  token_type?: string;
  expires_at?: string;
}

interface ZaiConfigResponse {
  completion_version?: number | string;
  recommand_model?: string;
}

interface ZaiChatResponse {
  id?: string;
}

interface ZaiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: Record<string, unknown>;
}

interface ZaiCompletionEvent {
  type?: string;
  data?: {
    delta_content?: string;
    edit_index?: number;
    edit_content?: string;
    usage?: ZaiUsage;
    done?: boolean;
  };
}

export interface ZaiInspectionResult {
  status: SessionStatus;
  user?: SessionUser;
  defaultModel?: string;
  frontendVersion?: string;
}

export interface ZaiTextExecutionResult {
  outputText: string;
  chatId: string;
  url: string;
  user?: SessionUser;
  usage?: ZaiUsage;
  model: string;
  frontendVersion: string;
}

type ZaiAuthorizedContext = {
  auth: Required<Pick<ZaiAuthResponse, "id" | "token">> & ZaiAuthResponse;
  user?: SessionUser;
  defaultModel: string;
  frontendVersion: string;
};

export class ZaiService {
  async inspectSession(client: SessionHttpClient): Promise<ZaiInspectionResult> {
    try {
      const auth = await this.fetchAuth(client);
      const [config, frontendVersion] = await Promise.all([this.fetchConfig(client), this.fetchFrontendVersion(client)]);

      return {
        status: {
          state: "active",
          message: "Z.ai session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: toZaiSessionUser(auth),
        defaultModel: normalizeModel(config.recommand_model),
        frontendVersion,
      };
    } catch (error) {
      if (isExpiredAuthError(error)) {
        return {
          status: {
            state: "expired",
            message: "Z.ai session expired. Re-import cookies.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "SESSION_EXPIRED",
          },
        };
      }

      if (isAutoCliError(error)) {
        return {
          status: {
            state: "unknown",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
        };
      }

      throw error;
    }
  }

  async executeText(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
    },
  ): Promise<ZaiTextExecutionResult> {
    try {
      const context = await this.createAuthorizedContext(client);
      const model = normalizeModel(input.model) ?? context.defaultModel;
      const chatId = await this.createChat(client, context.auth.token, model);
      const timestamp = String(Date.now());
      const requestId = randomUUID();
      const sortedPayload = buildZaiSortedPayload({
        requestId,
        timestamp,
        userId: context.auth.id,
      });
      const signature = buildZaiSignature(sortedPayload, input.prompt, timestamp);
      const url = `https://chat.z.ai/c/${chatId}`;
      const body = buildZaiCompletionBody({
        chatId,
        model,
        prompt: input.prompt,
        userName: context.auth.name ?? "User",
      });
      const params = buildZaiUrlParams({
        chatId,
        requestId,
        timestamp,
        token: context.auth.token,
        userId: context.auth.id,
      });

      const stream = await client.request<string>(`${ZAI_CHAT_COMPLETIONS_URL}?${params.toString()}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${context.auth.token}`,
          "content-type": "application/json",
          "accept-language": ZAI_ACCEPT_LANGUAGE,
          "x-fe-version": context.frontendVersion,
          "x-signature": signature,
        },
        body: JSON.stringify(body),
        responseType: "text",
        expectedStatus: 200,
      });

      const parsed = parseZaiCompletionStream(stream);

      return {
        outputText: parsed.outputText,
        chatId,
        url,
        user: context.user,
        usage: parsed.usage,
        model,
        frontendVersion: context.frontendVersion,
      };
    } catch (error) {
      throw mapZaiError(error, "Failed to complete the Z.ai text prompt.");
    }
  }

  private async createAuthorizedContext(client: SessionHttpClient): Promise<ZaiAuthorizedContext> {
    const [auth, config, frontendVersion] = await Promise.all([
      this.fetchAuth(client),
      this.fetchConfig(client),
      this.fetchFrontendVersion(client),
    ]);

    return {
      auth,
      user: toZaiSessionUser(auth),
      defaultModel: normalizeModel(config.recommand_model) ?? ZAI_DEFAULT_MODEL,
      frontendVersion,
    };
  }

  private async fetchAuth(client: SessionHttpClient): Promise<Required<Pick<ZaiAuthResponse, "id" | "token">> & ZaiAuthResponse> {
    const auth = await client.request<ZaiAuthResponse>(ZAI_AUTH_URL, {
      expectedStatus: 200,
    });

    if (!auth || typeof auth.id !== "string" || typeof auth.token !== "string") {
      throw new AutoCliError("ZAI_INVALID_AUTH_STATE", "Saved Z.ai session is missing the authenticated token. Re-import cookies.", {
        details: {
          hasUserId: typeof auth?.id === "string",
          hasToken: typeof auth?.token === "string",
        },
      });
    }

    return auth as Required<Pick<ZaiAuthResponse, "id" | "token">> & ZaiAuthResponse;
  }

  private async fetchConfig(client: SessionHttpClient): Promise<ZaiConfigResponse> {
    try {
      return await client.request<ZaiConfigResponse>(ZAI_CONFIG_URL, {
        expectedStatus: 200,
      });
    } catch {
      return {};
    }
  }

  private async fetchFrontendVersion(client: SessionHttpClient): Promise<string> {
    try {
      const html = await client.request<string>(ZAI_HOME_URL, {
        responseType: "text",
        expectedStatus: 200,
      });
      const match = html.match(/frontend\/(prod-fe-[^/]+)\//u);
      return match?.[1] ?? ZAI_DEFAULT_FE_VERSION;
    } catch {
      return ZAI_DEFAULT_FE_VERSION;
    }
  }

  private async createChat(client: SessionHttpClient, token: string, model: string): Promise<string> {
    const chat = await client.request<ZaiChatResponse>(ZAI_NEW_CHAT_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "accept-language": ZAI_ACCEPT_LANGUAGE,
      },
      body: JSON.stringify({
        chat: {
          title: "AutoCLI",
        },
        folder_id: null,
        from: "web",
        model,
        type: "direct",
      }),
      expectedStatus: 200,
    });

    if (!chat || typeof chat.id !== "string" || chat.id.length === 0) {
      throw new AutoCliError("ZAI_CHAT_CREATE_FAILED", "Failed to create a Z.ai chat before sending the prompt.");
    }

    return chat.id;
  }
}

export function buildZaiSortedPayload(input: { requestId: string; timestamp: string; userId: string }): string {
  const entries: Array<[string, string]> = [
    ["requestId", input.requestId],
    ["timestamp", input.timestamp],
    ["user_id", input.userId],
  ];

  return entries
    .sort((left, right) => left[0].localeCompare(right[0]))
    .flat()
    .join(",");
}

export function buildZaiSignature(sortedPayload: string, prompt: string, timestamp: string): string {
  const encodedPrompt = Buffer.from(prompt, "utf8").toString("base64");
  const data = `${sortedPayload}|${encodedPrompt}|${timestamp}`;
  const bucket = Math.floor(Number(timestamp) / (5 * 60 * 1_000));
  const bucketKey = createHmac("sha256", ZAI_SIGNATURE_SECRET).update(String(bucket)).digest("hex");
  return createHmac("sha256", bucketKey).update(data).digest("hex");
}

export function parseZaiCompletionStream(stream: string): { outputText: string; usage?: ZaiUsage } {
  let outputText = "";
  let usage: ZaiUsage | undefined;

  for (const block of stream.split(/\n\s*\n/u)) {
    const trimmed = block.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const raw = trimmed.slice(5).trim();
    if (!raw || raw === "[DONE]") {
      continue;
    }

    let event: ZaiCompletionEvent;
    try {
      event = JSON.parse(raw) as ZaiCompletionEvent;
    } catch {
      continue;
    }

    const data = event.data;
    if (!data || typeof data !== "object") {
      continue;
    }

    if (typeof data.delta_content === "string" && data.delta_content.length > 0) {
      outputText += data.delta_content;
    }

    if (typeof data.edit_index === "number" && typeof data.edit_content === "string") {
      outputText = `${outputText.slice(0, data.edit_index)}${data.edit_content}`;
    }

    if (data.usage && typeof data.usage === "object") {
      usage = data.usage;
    }
  }

  const normalizedOutput = outputText.trim();
  if (!normalizedOutput) {
    throw new AutoCliError("ZAI_EMPTY_RESPONSE", "Z.ai did not return any assistant text.", {
      details: {
        preview: stream.slice(0, 400),
      },
    });
  }

  return {
    outputText: normalizedOutput,
    usage,
  };
}

function buildZaiUrlParams(input: { chatId: string; requestId: string; timestamp: string; token: string; userId: string }): URLSearchParams {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const osName = resolveZaiOsName();
  const currentUrl = `https://chat.z.ai/c/${input.chatId}`;

  return new URLSearchParams({
    timestamp: input.timestamp,
    requestId: input.requestId,
    user_id: input.userId,
    version: ZAI_VERSION,
    platform: ZAI_PLATFORM,
    token: input.token,
    user_agent: resolveZaiUserAgent(),
    language: ZAI_ACCEPT_LANGUAGE,
    languages: ZAI_LANGUAGE_LIST,
    timezone: timeZone,
    cookie_enabled: "true",
    screen_width: ZAI_SCREEN_WIDTH,
    screen_height: ZAI_SCREEN_HEIGHT,
    screen_resolution: `${ZAI_SCREEN_WIDTH}x${ZAI_SCREEN_HEIGHT}`,
    viewport_height: ZAI_VIEWPORT_HEIGHT,
    viewport_width: ZAI_VIEWPORT_WIDTH,
    viewport_size: `${ZAI_VIEWPORT_WIDTH}x${ZAI_VIEWPORT_HEIGHT}`,
    color_depth: ZAI_COLOR_DEPTH,
    pixel_ratio: ZAI_PIXEL_RATIO,
    current_url: currentUrl,
    pathname: `/c/${input.chatId}`,
    search: "",
    hash: "",
    host: "chat.z.ai",
    hostname: "chat.z.ai",
    protocol: "https:",
    referrer: ZAI_HOME_URL,
    title: "Z.ai - Free AI Chatbot & Agent powered by GLM-5 & GLM-4.7",
    timezone_offset: String(now.getTimezoneOffset()),
    local_time: now.toString(),
    utc_time: now.toUTCString(),
    is_mobile: "false",
    is_touch: "false",
    max_touch_points: "0",
    browser_name: ZAI_BROWSER_NAME,
    os_name: osName,
    signature_timestamp: input.timestamp,
  });
}

function buildZaiCompletionBody(input: { chatId: string; model: string; prompt: string; userName: string }): Record<string, unknown> {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return {
    stream: true,
    model: input.model,
    messages: [
      {
        role: "user",
        content: input.prompt,
      },
    ],
    signature_prompt: input.prompt,
    params: {},
    extra: {},
    features: {
      image_generation: false,
      web_search: false,
      auto_web_search: false,
      preview_mode: true,
      flags: [],
      enable_thinking: false,
    },
    variables: {
      "{{USER_NAME}}": input.userName || "User",
      "{{USER_LOCATION}}": "Unknown",
      "{{CURRENT_DATETIME}}": formatZaiDateTime(now),
      "{{CURRENT_DATE}}": formatZaiDate(now),
      "{{CURRENT_TIME}}": formatZaiTime(now),
      "{{CURRENT_WEEKDAY}}": formatZaiWeekday(now),
      "{{CURRENT_TIMEZONE}}": timeZone,
      "{{USER_LANGUAGE}}": ZAI_ACCEPT_LANGUAGE,
    },
    chat_id: input.chatId,
    id: randomUUID(),
    current_user_message_id: randomUUID(),
    current_user_message_parent_id: randomUUID(),
    background_tasks: {
      title_generation: true,
      tags_generation: true,
    },
  };
}

function toZaiSessionUser(auth: ZaiAuthResponse): SessionUser | undefined {
  if (typeof auth.id !== "string" && typeof auth.name !== "string" && typeof auth.email !== "string") {
    return undefined;
  }

  return {
    id: auth.id,
    username: auth.email,
    displayName: auth.name,
  };
}

function normalizeModel(model: unknown): string | undefined {
  return typeof model === "string" && model.trim().length > 0 ? model.trim() : undefined;
}

function resolveZaiOsName(): string {
  switch (process.platform) {
    case "darwin":
      return "Mac OS";
    case "win32":
      return "Windows";
    default:
      return "Linux";
  }
}

function resolveZaiUserAgent(): string {
  switch (process.platform) {
    case "darwin":
      return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
    case "win32":
      return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
    default:
      return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
  }
}

function formatZaiDateTime(date: Date): string {
  return `${formatZaiDate(date)} ${formatZaiTime(date)}`;
}

function formatZaiDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatZaiTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatZaiWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function mapZaiError(error: unknown, fallbackMessage: string): AutoCliError {
  if (!isAutoCliError(error)) {
    return new AutoCliError("ZAI_REQUEST_FAILED", fallbackMessage, {
      cause: error,
    });
  }

  if (isExpiredAuthError(error)) {
    return new AutoCliError("SESSION_EXPIRED", "Z.ai session expired. Re-import cookies.", {
      details: error.details,
      cause: error,
    });
  }

  if (error.code === "HTTP_REQUEST_FAILED") {
    const upstream = extractUpstreamMessage(error.details?.body);
    return new AutoCliError("ZAI_REQUEST_FAILED", upstream ?? fallbackMessage, {
      details: error.details,
      cause: error,
    });
  }

  return error;
}

function extractUpstreamMessage(body: unknown): string | undefined {
  if (typeof body !== "string" || body.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as { detail?: unknown; error?: { message?: unknown } };
    if (typeof parsed.detail === "string" && parsed.detail.length > 0) {
      return parsed.detail.replace(/^\d+:\s*/u, "");
    }
    if (typeof parsed.error?.message === "string" && parsed.error.message.length > 0) {
      return parsed.error.message;
    }
  } catch {
    return body;
  }

  return undefined;
}

function isExpiredAuthError(error: unknown): boolean {
  return isAutoCliError(error) && error.code === "HTTP_REQUEST_FAILED" && [401, 403].includes(Number(error.details?.status));
}

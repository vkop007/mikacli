import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Cookie, CookieJar } from "tough-cookie";
import { ModuleClient, SessionClient } from "tlsclientwrapper";

import { MikaCliError, isMikaCliError } from "../../../errors.js";

import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus, SessionUser } from "../../../types.js";

const MISTRAL_HOME_URL = "https://chat.mistral.ai/";
const MISTRAL_TRPC_BASE_URL = `${MISTRAL_HOME_URL}api/trpc/`;
const MISTRAL_CHAT_URL = `${MISTRAL_HOME_URL}api/chat`;
const MISTRAL_DEFAULT_MODEL = "mistral-medium-latest";
const MISTRAL_TLS_CLIENT_IDENTIFIER = "chrome_146";
const MISTRAL_TLS_DEFAULT_HEADERS = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"macOS\"",
} as const;
const MISTRAL_HOME_REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "cache-control": "max-age=0",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
} as const;
const MISTRAL_TRPC_QUERY_HEADERS = {
  accept: "application/json",
  origin: "https://chat.mistral.ai",
  referer: MISTRAL_HOME_URL,
  "x-trpc-source": "nextjs-react",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
} as const;
const MISTRAL_TRPC_MUTATION_HEADERS = {
  ...MISTRAL_TRPC_QUERY_HEADERS,
  "content-type": "application/json",
} as const;
const MISTRAL_TEXT_TIMEOUT_MS = 30_000;
const MISTRAL_POLL_INTERVAL_MS = 750;

interface MistralTrpcErrorEnvelope {
  message?: string;
  code?: number;
  data?: {
    code?: string;
    httpStatus?: number;
    path?: string;
    zodError?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    } | null;
  };
}

interface MistralTrpcEnvelope<T> {
  result?: {
    data?: {
      json?: T;
      meta?: Record<string, unknown>;
    };
  };
  error?: {
    json?: MistralTrpcErrorEnvelope;
  };
}

interface MistralSessionRecord {
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
  organization?: {
    id?: string;
    name?: string;
  };
  workspace?: {
    id?: string;
    name?: string;
  } | null;
}

interface MistralContentChunk {
  type?: string;
  text?: string;
}

interface MistralMessageRecord {
  id?: string;
  role?: string;
  content?: string | null;
  contentChunks?: MistralContentChunk[] | null;
  createdAt?: string;
  chatId?: string;
  parentId?: string | null;
  parentVersion?: number | null;
  generationStatus?: string | null;
  model?: string | null;
  references?: unknown[] | null;
}

interface MistralNewChatResponse {
  messages?: MistralMessageRecord;
  chatId?: string;
}

interface MistralMessagesResponse {
  items?: MistralMessageRecord[];
  nextCursor?: unknown;
}

interface MistralStreamMessagePatch {
  op?: string;
  path?: string;
  value?: unknown;
}

interface MistralChatStreamPayload {
  json?: {
    type?: string;
    messageId?: string;
    messageVersion?: number;
    patches?: MistralStreamMessagePatch[];
  };
}

export interface MistralInspectionResult {
  status: SessionStatus;
  user?: SessionUser;
  defaultModel: string;
}

export interface MistralTextExecutionResult {
  outputText: string;
  chatId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  model: string;
  mode: "anonymous-web" | "authenticated-web";
  url: string;
  user?: SessionUser;
  references: unknown[];
}

export interface ParsedMistralChatStream {
  assistantMessageId?: string;
  outputText: string;
}

export class MistralService {
  async inspectSession(client: SessionHttpClient): Promise<MistralInspectionResult> {
    try {
      return await withMistralTlsSession(client.jar, async (session, jar) => {
        const sessionRecord = await fetchMistralUserSession(session, jar).catch((error) => {
          if (isMistralUnauthorizedError(error)) {
            return null;
          }

          throw error;
        });

        if (!sessionRecord || !hasAuthenticatedMistralSession(sessionRecord)) {
          return {
            status: {
              state: "expired",
              message: "Mistral session expired. Re-import cookies.",
              lastValidatedAt: new Date().toISOString(),
              lastErrorCode: "SESSION_EXPIRED",
            },
            defaultModel: MISTRAL_DEFAULT_MODEL,
          };
        }

        return {
          status: {
            state: "active",
            message: "Mistral session is active.",
            lastValidatedAt: new Date().toISOString(),
          },
          user: toMistralSessionUser(sessionRecord.user),
          defaultModel: MISTRAL_DEFAULT_MODEL,
        };
      });
    } catch (error) {
      if (isMikaCliError(error)) {
        return {
          status: {
            state: error.code === "SESSION_EXPIRED" ? "expired" : "unknown",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
          defaultModel: MISTRAL_DEFAULT_MODEL,
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
  ): Promise<MistralTextExecutionResult> {
    try {
      return await withMistralTlsSession(client.jar, async (session, jar) => {
        const sessionRecord = await fetchMistralUserSession(session, jar).catch((error) => {
          if (isMistralUnauthorizedError(error)) {
            return null;
          }

          throw error;
        });
        const mode: MistralTextExecutionResult["mode"] = hasAuthenticatedMistralSession(sessionRecord)
          ? "authenticated-web"
          : "anonymous-web";
        const user = toMistralSessionUser(sessionRecord?.user);

        const createdChat = await createMistralChat(session, jar, {
          prompt: input.prompt,
        });

        if (!createdChat.chatId) {
          throw new MikaCliError("MISTRAL_CHAT_CREATE_FAILED", "Mistral did not return a chat ID for the new conversation.");
        }

        const stream = await startMistralChat(session, jar, {
          chatId: createdChat.chatId,
          model: input.model,
          stableAnonymousIdentifier: (await readMistralStableAnonymousIdentifier(jar)) ?? randomUUID(),
        });
        const parsedStream = parseMistralChatStream(stream);
        const assistantMessage = await waitForMistralAssistant(session, jar, {
          chatId: createdChat.chatId,
          userMessageId: createdChat.messages?.id,
          assistantMessageId: parsedStream.assistantMessageId,
        });
        const outputText = extractMistralMessageText(assistantMessage).trim() || parsedStream.outputText.trim();

        if (!outputText) {
          throw new MikaCliError("MISTRAL_EMPTY_RESPONSE", "Mistral returned an empty response.", {
            details: {
              chatId: createdChat.chatId,
              assistantMessageId: assistantMessage.id ?? parsedStream.assistantMessageId,
            },
          });
        }

        return {
          outputText,
          chatId: createdChat.chatId,
          userMessageId: createdChat.messages?.id,
          assistantMessageId: assistantMessage.id ?? parsedStream.assistantMessageId,
          model: assistantMessage.model ?? (input.model?.trim() ?? MISTRAL_DEFAULT_MODEL),
          mode,
          url: `https://chat.mistral.ai/chat/${createdChat.chatId}`,
          user,
          references: Array.isArray(assistantMessage.references) ? assistantMessage.references : [],
        };
      });
    } catch (error) {
      throw mapMistralError(error, "Failed to complete the Mistral prompt.");
    }
  }
}

async function withMistralTlsSession<T>(
  jar: CookieJar,
  action: (session: SessionClient, jar: CookieJar) => Promise<T>,
): Promise<T> {
  const moduleClient = new ModuleClient();
  await moduleClient.open();

  const session = new SessionClient(moduleClient, {
    tlsClientIdentifier: MISTRAL_TLS_CLIENT_IDENTIFIER,
    followRedirects: true,
    timeoutSeconds: 30,
    defaultHeaders: MISTRAL_TLS_DEFAULT_HEADERS,
    defaultCookies: await exportJarCookiesForTls(jar, MISTRAL_HOME_URL),
  });

  try {
    const homeResponse = await session.get(MISTRAL_HOME_URL, {
      headers: MISTRAL_HOME_REQUEST_HEADERS,
    });
    await applyTlsCookiesToJar(jar, MISTRAL_HOME_URL, homeResponse.headers);
    session.setDefaultCookies(await exportJarCookiesForTls(jar, MISTRAL_HOME_URL));

    if (homeResponse.status !== 200) {
      throw createMistralRequestError(homeResponse.status, homeResponse.body, MISTRAL_HOME_URL);
    }

    return await action(session, jar);
  } finally {
    await session.destroySession().catch(() => {});
    await moduleClient.terminate().catch(() => {});
  }
}

async function fetchMistralUserSession(session: SessionClient, jar: CookieJar): Promise<MistralSessionRecord> {
  return await mistralTrpcQuery<MistralSessionRecord>(session, jar, "user.session", {});
}

async function createMistralChat(
  session: SessionClient,
  jar: CookieJar,
  input: {
    prompt: string;
  },
): Promise<MistralNewChatResponse> {
  return await mistralTrpcMutation<MistralNewChatResponse>(session, jar, "message.newChat", {
    content: [
      {
        type: "text",
        text: input.prompt,
      },
    ],
    files: [],
    features: [],
    integrations: [],
  });
}

async function fetchMistralMessages(
  session: SessionClient,
  jar: CookieJar,
  chatId: string,
): Promise<MistralMessagesResponse> {
  return await mistralTrpcQuery<MistralMessagesResponse>(session, jar, "message.all", {
    chatId,
  });
}

async function startMistralChat(
  session: SessionClient,
  jar: CookieJar,
  input: {
    chatId: string;
    stableAnonymousIdentifier: string;
    model?: string;
  },
): Promise<string> {
  const response = await session.post(
    MISTRAL_CHAT_URL,
    JSON.stringify({
      chatId: input.chatId,
      mode: "start",
      ...(input.model?.trim()
        ? {
            model: input.model.trim(),
          }
        : {}),
      clientPromptData: {
        currentDate: formatMistralCurrentDate(resolveUserTimeZone()),
        userTimezone: resolveUserTimeZone(),
      },
      stableAnonymousIdentifier: input.stableAnonymousIdentifier,
      disabledFeatures: [],
      shouldAwaitStreamBackgroundTasks: true,
      shouldUseMessagePatch: true,
      shouldUsePersistentStream: true,
    }),
    {
      headers: {
        ...MISTRAL_TRPC_QUERY_HEADERS,
        accept: "text/plain, */*",
        "content-type": "application/json",
        referer: `${MISTRAL_HOME_URL}chat/${input.chatId}`,
      },
    },
  );

  await applyTlsCookiesToJar(jar, MISTRAL_HOME_URL, response.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, MISTRAL_HOME_URL));

  if (response.status !== 200) {
    throw createMistralRequestError(response.status, response.body, MISTRAL_CHAT_URL);
  }

  return response.body;
}

async function waitForMistralAssistant(
  session: SessionClient,
  jar: CookieJar,
  input: {
    chatId: string;
    userMessageId?: string;
    assistantMessageId?: string;
  },
): Promise<MistralMessageRecord> {
  const deadline = Date.now() + MISTRAL_TEXT_TIMEOUT_MS;
  let lastSeenAssistant: MistralMessageRecord | undefined;

  while (Date.now() < deadline) {
    const messages = await fetchMistralMessages(session, jar, input.chatId);
    const items = Array.isArray(messages.items) ? messages.items : [];
    const assistant =
      items.find((message) => typeof input.assistantMessageId === "string" && message.id === input.assistantMessageId) ??
      items.find(
        (message) =>
          message.role === "assistant" &&
          (!input.userMessageId || message.parentId === input.userMessageId),
      ) ??
      items.find((message) => message.role === "assistant");

    if (assistant) {
      lastSeenAssistant = assistant;
      if (assistant.generationStatus === "failed") {
        throw new MikaCliError("MISTRAL_GENERATION_FAILED", "Mistral reported that the generation failed.", {
          details: {
            chatId: input.chatId,
            assistantMessageId: assistant.id,
          },
        });
      }

      if (assistant.generationStatus === "canceled") {
        throw new MikaCliError("MISTRAL_GENERATION_CANCELED", "Mistral canceled the generation before it completed.", {
          details: {
            chatId: input.chatId,
            assistantMessageId: assistant.id,
          },
        });
      }

      if (assistant.generationStatus === "success" && extractMistralMessageText(assistant).trim()) {
        return assistant;
      }
    }

    await delay(MISTRAL_POLL_INTERVAL_MS);
  }

  throw new MikaCliError("MISTRAL_TIMEOUT", "Mistral did not finish responding before the timeout.", {
    details: {
      chatId: input.chatId,
      assistantMessageId: lastSeenAssistant?.id,
      generationStatus: lastSeenAssistant?.generationStatus,
    },
  });
}

async function mistralTrpcQuery<T>(
  session: SessionClient,
  jar: CookieJar,
  procedure: string,
  jsonInput: unknown,
): Promise<T> {
  const response = await session.get(buildMistralTrpcQueryUrl(procedure, jsonInput), {
    headers: MISTRAL_TRPC_QUERY_HEADERS,
  });

  await applyTlsCookiesToJar(jar, MISTRAL_HOME_URL, response.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, MISTRAL_HOME_URL));

  return parseMistralTrpcResponse<T>(response.status, response.body, procedure);
}

async function mistralTrpcMutation<T>(
  session: SessionClient,
  jar: CookieJar,
  procedure: string,
  jsonInput: unknown,
): Promise<T> {
  const response = await session.post(
    `${MISTRAL_TRPC_BASE_URL}${procedure}?batch=1`,
    JSON.stringify({
      0: {
        json: jsonInput,
      },
    }),
    {
      headers: MISTRAL_TRPC_MUTATION_HEADERS,
    },
  );

  await applyTlsCookiesToJar(jar, MISTRAL_HOME_URL, response.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, MISTRAL_HOME_URL));

  return parseMistralTrpcResponse<T>(response.status, response.body, procedure);
}

function buildMistralTrpcQueryUrl(procedure: string, jsonInput: unknown): string {
  return `${MISTRAL_TRPC_BASE_URL}${procedure}?batch=1&input=${encodeURIComponent(
    JSON.stringify({
      0: {
        json: jsonInput,
      },
    }),
  )}`;
}

function parseMistralTrpcResponse<T>(status: number, body: string, procedure: string): T {
  const parsed = safeParseJson<MistralTrpcEnvelope<T>[]>(body);
  const envelope = Array.isArray(parsed) ? parsed[0] : undefined;

  if (envelope?.error?.json) {
    throw createMistralTrpcError(envelope.error.json, status);
  }

  if (status !== 200) {
    throw createMistralRequestError(status, body, `${MISTRAL_TRPC_BASE_URL}${procedure}`);
  }

  const result = envelope?.result?.data?.json;
  if (typeof result === "undefined") {
    throw new MikaCliError("MISTRAL_TRPC_INVALID_RESPONSE", `Mistral did not return a valid ${procedure} result.`, {
      details: {
        procedure,
        status,
        preview: body.slice(0, 400),
      },
    });
  }

  return result;
}

function createMistralTrpcError(error: MistralTrpcErrorEnvelope, status: number): MikaCliError {
  const code = error.data?.code ?? "TRPC_ERROR";
  const httpStatus = error.data?.httpStatus ?? status;
  const message = error.message ?? "Mistral returned an unexpected tRPC error.";

  if (httpStatus === 401 || code === "UNAUTHORIZED") {
    return new MikaCliError("SESSION_EXPIRED", "Mistral session expired. Re-import cookies.", {
      details: {
        procedure: error.data?.path,
        upstreamCode: code,
      },
    });
  }

  return new MikaCliError(`MISTRAL_${code}`, message, {
    details: {
      procedure: error.data?.path,
      httpStatus,
      zodError: error.data?.zodError ?? undefined,
    },
  });
}

function createMistralRequestError(status: number, body: string, url: string): MikaCliError {
  let upstreamCode: string | undefined;
  let upstreamMessage: string | undefined;

  if (body.trim().startsWith("{")) {
    const parsed = safeParseJson<Record<string, unknown>>(body);
    if (parsed) {
      upstreamCode = typeof parsed.code === "string" ? parsed.code : undefined;
      upstreamMessage = typeof parsed.detail === "string" ? parsed.detail : undefined;
    }
  }

  return new MikaCliError("MISTRAL_REQUEST_FAILED", upstreamMessage ?? `Mistral request failed with ${status}.`, {
    details: {
      url,
      status,
      upstreamCode,
      upstreamMessage,
      body: body.slice(0, 400),
    },
  });
}

function hasAuthenticatedMistralSession(session: MistralSessionRecord | null | undefined): session is MistralSessionRecord {
  return Boolean(session?.user?.id || session?.user?.email || session?.organization?.id || session?.workspace?.id);
}

function toMistralSessionUser(user: MistralSessionRecord["user"] | null | undefined): SessionUser | undefined {
  if (!user) {
    return undefined;
  }

  return {
    id: typeof user.id === "string" ? user.id : undefined,
    displayName: typeof user.name === "string" ? user.name : undefined,
    username: typeof user.email === "string" ? user.email : undefined,
  };
}

export function parseMistralChatStream(raw: string): ParsedMistralChatStream {
  const messageTexts = new Map<string, string>();
  let assistantMessageId: string | undefined;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const payload = safeParseJson<MistralChatStreamPayload>(trimmed.slice(separatorIndex + 1));
    const messageId = payload?.json?.messageId;
    const patches = payload?.json?.patches;
    if (typeof messageId !== "string" || !Array.isArray(patches)) {
      continue;
    }

    for (const patch of patches) {
      if (!patch || typeof patch.path !== "string") {
        continue;
      }

      if (
        patch.path === "/" &&
        patch.op === "replace" &&
        isRecord(patch.value) &&
        patch.value.role === "assistant"
      ) {
        assistantMessageId = typeof patch.value.id === "string" ? patch.value.id : messageId;
        continue;
      }

      if (patch.path === "/contentChunks" && patch.op === "replace" && Array.isArray(patch.value)) {
        messageTexts.set(messageId, extractTextFromContentChunks(patch.value));
        continue;
      }

      if (patch.path.endsWith("/text")) {
        const nextValue = typeof patch.value === "string" ? patch.value : "";
        if (patch.op === "append") {
          messageTexts.set(messageId, `${messageTexts.get(messageId) ?? ""}${nextValue}`);
        } else if (patch.op === "replace") {
          messageTexts.set(messageId, nextValue);
        }
      }
    }
  }

  return {
    assistantMessageId,
    outputText: assistantMessageId ? messageTexts.get(assistantMessageId) ?? "" : "",
  };
}

export function extractMistralMessageText(message: Pick<MistralMessageRecord, "content" | "contentChunks">): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }

  if (Array.isArray(message.contentChunks)) {
    return extractTextFromContentChunks(message.contentChunks);
  }

  return "";
}

function extractTextFromContentChunks(chunks: unknown[]): string {
  return chunks
    .map((chunk) => (isRecord(chunk) && chunk.type === "text" && typeof chunk.text === "string" ? chunk.text : ""))
    .join("");
}

async function readMistralStableAnonymousIdentifier(jar: CookieJar): Promise<string | undefined> {
  const cookies = await jar.getCookies(MISTRAL_HOME_URL);
  return cookies.find((cookie) => cookie.key === "anonymousUser")?.value;
}

function formatMistralCurrentDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function resolveUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isMistralUnauthorizedError(error: unknown): boolean {
  return isMikaCliError(error) && error.code === "SESSION_EXPIRED";
}

export function mapMistralError(error: unknown, fallbackMessage: string): MikaCliError {
  if (isMikaCliError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new MikaCliError("MISTRAL_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details: {
        message: error.message,
      },
    });
  }

  return new MikaCliError("MISTRAL_REQUEST_FAILED", fallbackMessage);
}

async function exportJarCookiesForTls(
  jar: CookieJar,
  url: string,
): Promise<
  Array<{
    domain: string;
    expires: number;
    name: string;
    path: string;
    value: string;
    secure?: boolean;
    httpOnly?: boolean;
  }>
> {
  const cookies = await jar.getCookies(url);
  const now = Math.floor(Date.now() / 1000);
  const fallbackDomain = new URL(url).hostname;

  return cookies.map((cookie) => ({
    domain: cookie.domain ?? fallbackDomain,
    expires: cookie.expires instanceof Date ? Math.floor(cookie.expires.getTime() / 1000) : now + 86400,
    name: cookie.key,
    path: cookie.path ?? "/",
    value: cookie.value,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
  }));
}

async function applyTlsCookiesToJar(
  jar: CookieJar,
  url: string,
  headers: Record<string, string | string[] | undefined> | null | undefined,
): Promise<void> {
  const setCookieHeaders = extractHeaderValues(headers, "set-cookie");
  for (const value of setCookieHeaders) {
    const parsed = Cookie.parse(value);
    if (!parsed) {
      continue;
    }

    await jar.setCookie(parsed, url, { ignoreError: true });
  }
}

function extractHeaderValues(
  headers: Record<string, string | string[] | undefined> | null | undefined,
  name: string,
): string[] {
  if (!headers) {
    return [];
  }

  const entry = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? headers["Set-Cookie"];
  if (!entry) {
    return [];
  }

  return Array.isArray(entry) ? entry.filter((value): value is string => typeof value === "string") : [entry];
}

function safeParseJson<T>(input: string): T | undefined {
  try {
    return JSON.parse(input) as T;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

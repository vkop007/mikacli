import { randomUUID } from "node:crypto";

import { Cookie, CookieJar } from "tough-cookie";
import { ModuleClient, SessionClient } from "tlsclientwrapper";

import { MikaCliError, isMikaCliError } from "../../../errors.js";

import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus, SessionUser } from "../../../types.js";

const PERPLEXITY_BASE_URL = "https://www.perplexity.ai";
const PERPLEXITY_HOME_URL = `${PERPLEXITY_BASE_URL}/`;
const PERPLEXITY_AUTH_SESSION_URL = `${PERPLEXITY_BASE_URL}/api/auth/session`;
const PERPLEXITY_SOCKET_IO_URL = `${PERPLEXITY_BASE_URL}/socket.io/`;
const PERPLEXITY_DEFAULT_MODEL = "turbo";
const PERPLEXITY_TLS_CLIENT_IDENTIFIER = "chrome_146";
const PERPLEXITY_TLS_DEFAULT_HEADERS = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"macOS\"",
} as const;
const PERPLEXITY_HOME_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "cache-control": "max-age=0",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
} as const;
const PERPLEXITY_SOCKET_HEADERS = {
  accept: "*/*",
  referer: PERPLEXITY_HOME_URL,
  origin: PERPLEXITY_BASE_URL,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
} as const;
const PERPLEXITY_SOCKET_POST_HEADERS = {
  ...PERPLEXITY_SOCKET_HEADERS,
  "content-type": "text/plain;charset=UTF-8",
} as const;
const PERPLEXITY_TEXT_TIMEOUT_MS = 30_000;

interface PerplexityAuthSessionResponse {
  user?: {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    subscription_tier?: string;
    subscription_status?: string;
    payment_tier?: string;
  };
}

interface PerplexityAnswerModeRecord {
  answer_mode_type?: string;
  has_preview?: boolean;
}

interface PerplexityMarkdownBlockRecord {
  progress?: string;
  chunks?: string[];
  text?: string;
  chunk_starting_offset?: number;
}

interface PerplexityPlanBlockRecord {
  progress?: string;
  final?: boolean;
}

interface PerplexityResponseBlockRecord {
  intended_usage?: string;
  markdown_block?: PerplexityMarkdownBlockRecord;
  plan_block?: PerplexityPlanBlockRecord;
}

interface PerplexityProgressPayload {
  backend_uuid?: string;
  uuid?: string;
  thread_url_slug?: string;
  display_model?: string;
  mode?: string;
  search_focus?: string;
  status?: string;
  final?: boolean;
  text?: string;
  answer_modes?: PerplexityAnswerModeRecord[];
  blocks?: PerplexityResponseBlockRecord[];
}

interface PerplexityFinalAnswerRecord {
  answer?: string;
  structured_answer?: Array<{
    type?: string;
    text?: string;
  }>;
  web_results?: unknown[];
}

interface PerplexityInspectionResult {
  status: SessionStatus;
  user?: SessionUser;
  defaultModel: string;
  subscriptionTier?: string;
}

export interface PerplexityTextExecutionResult {
  outputText: string;
  model: string;
  mode: string;
  searchFocus: string;
  queryId?: string;
  backendUuid?: string;
  threadUrlSlug?: string;
  url?: string;
  answerModes: string[];
  webResults: unknown[];
  user?: SessionUser;
  subscriptionTier?: string;
}

interface ParsedPerplexityCompletion {
  outputText: string;
  model: string;
  mode: string;
  searchFocus: string;
  queryId?: string;
  backendUuid?: string;
  threadUrlSlug?: string;
  answerModes: string[];
  webResults: unknown[];
}

export class PerplexityService {
  async inspectSession(client: SessionHttpClient): Promise<PerplexityInspectionResult> {
    try {
      const auth = await this.fetchAuthSession(client);
      if (!auth.user?.id) {
        return {
          status: {
            state: "expired",
            message: "Perplexity session expired. Re-import cookies.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "SESSION_EXPIRED",
          },
          defaultModel: PERPLEXITY_DEFAULT_MODEL,
        };
      }

      return {
        status: {
          state: "active",
          message: "Perplexity session is active. Browserless prompting is available.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: toPerplexitySessionUser(auth.user),
        defaultModel: PERPLEXITY_DEFAULT_MODEL,
        subscriptionTier: readPerplexitySubscriptionTier(auth.user),
      };
    } catch (error) {
      if (isMikaCliError(error)) {
        return {
          status: {
            state: error.code === "SESSION_EXPIRED" ? "expired" : "unknown",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
          defaultModel: PERPLEXITY_DEFAULT_MODEL,
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
  ): Promise<PerplexityTextExecutionResult> {
    try {
      const auth = await this.fetchAuthSession(client);
      if (!auth.user?.id) {
        throw new MikaCliError("SESSION_EXPIRED", "Perplexity session expired. Re-import cookies.");
      }

      const parsed = await withPerplexityTlsSession(client.jar, async (session) => {
        const sid = await openPerplexityPollingSession(session, client.jar);
        await authorizePerplexityNamespace(session, client.jar, sid);
        await sendPerplexityTextPrompt(session, client.jar, sid, input.prompt);
        return await pollPerplexityAnswer(session, client.jar, sid);
      });

      if (!parsed.outputText) {
        throw new MikaCliError("PERPLEXITY_EMPTY_RESPONSE", "Perplexity returned an empty response.", {
          details: {
            queryId: parsed.queryId,
            threadUrlSlug: parsed.threadUrlSlug,
          },
        });
      }

      return {
        ...parsed,
        url: parsed.threadUrlSlug ? `${PERPLEXITY_BASE_URL}/search/${parsed.threadUrlSlug}` : undefined,
        user: toPerplexitySessionUser(auth.user),
        subscriptionTier: readPerplexitySubscriptionTier(auth.user),
      };
    } catch (error) {
      throw mapPerplexityError(error, "Failed to complete the Perplexity prompt.");
    }
  }

  private async fetchAuthSession(client: SessionHttpClient): Promise<PerplexityAuthSessionResponse> {
    const { data, response } = await client.requestWithResponse<PerplexityAuthSessionResponse>(PERPLEXITY_AUTH_SESSION_URL, {
      expectedStatus: [200, 401],
      headers: {
        accept: "application/json,text/plain,*/*",
        referer: PERPLEXITY_HOME_URL,
        origin: PERPLEXITY_BASE_URL,
      },
    });

    if (response.status === 401) {
      throw new MikaCliError("SESSION_EXPIRED", "Perplexity session expired. Re-import cookies.");
    }

    return data;
  }
}

async function withPerplexityTlsSession<T>(jar: CookieJar, action: (session: SessionClient) => Promise<T>): Promise<T> {
  const moduleClient = new ModuleClient();
  await moduleClient.open();

  const session = new SessionClient(moduleClient, {
    tlsClientIdentifier: PERPLEXITY_TLS_CLIENT_IDENTIFIER,
    followRedirects: true,
    timeoutSeconds: 30,
    defaultHeaders: PERPLEXITY_TLS_DEFAULT_HEADERS,
    defaultCookies: await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL),
  });

  try {
    const homeResponse = await session.get(PERPLEXITY_HOME_URL, {
      headers: PERPLEXITY_HOME_HEADERS,
    });

    await applyTlsCookiesToJar(jar, PERPLEXITY_HOME_URL, homeResponse.headers);
    session.setDefaultCookies(await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL));

    if (homeResponse.status !== 200) {
      throw createPerplexityRequestError(homeResponse.status, homeResponse.body, PERPLEXITY_HOME_URL);
    }

    return await action(session);
  } finally {
    await session.destroySession().catch(() => {});
    await moduleClient.terminate().catch(() => {});
  }
}

async function openPerplexityPollingSession(session: SessionClient, jar: CookieJar): Promise<string> {
  const response = await session.get(
    `${PERPLEXITY_SOCKET_IO_URL}?EIO=4&transport=polling&t=${createPerplexityTransportToken()}`,
    {
      headers: PERPLEXITY_SOCKET_HEADERS,
    },
  );
  await applyTlsCookiesToJar(jar, PERPLEXITY_HOME_URL, response.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL));

  if (response.status !== 200) {
    throw createPerplexityRequestError(response.status, response.body, PERPLEXITY_SOCKET_IO_URL);
  }

  const packet = response.body.trim();
  if (!packet.startsWith("0")) {
    throw new MikaCliError("PERPLEXITY_SOCKET_OPEN_FAILED", "Perplexity did not return a valid Socket.IO open packet.", {
      details: {
        preview: packet.slice(0, 200),
      },
    });
  }

  const parsed = safeParseJson<Record<string, unknown>>(packet.slice(1));
  const sid = typeof parsed?.sid === "string" ? parsed.sid : undefined;
  if (!sid) {
    throw new MikaCliError("PERPLEXITY_SOCKET_OPEN_FAILED", "Perplexity did not return a valid Socket.IO session ID.", {
      details: {
        preview: packet.slice(0, 200),
      },
    });
  }

  return sid;
}

async function authorizePerplexityNamespace(session: SessionClient, jar: CookieJar, sid: string): Promise<void> {
  const authResponse = await session.post(
    `${PERPLEXITY_SOCKET_IO_URL}?EIO=4&transport=polling&t=${Date.now()}&sid=${encodeURIComponent(sid)}`,
    '40{"jwt":"anonymous-ask-user"}',
    {
      headers: PERPLEXITY_SOCKET_POST_HEADERS,
    },
  );
  await applyTlsCookiesToJar(jar, PERPLEXITY_HOME_URL, authResponse.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL));

  if (authResponse.status !== 200 || authResponse.body.trim() !== "OK") {
    throw new MikaCliError("PERPLEXITY_SOCKET_AUTH_FAILED", "Perplexity rejected the Socket.IO namespace authorization.", {
      details: {
        status: authResponse.status,
        body: authResponse.body.slice(0, 200),
      },
    });
  }

  const connectResponse = await session.get(
    `${PERPLEXITY_SOCKET_IO_URL}?EIO=4&transport=polling&t=${Date.now() + 1}&sid=${encodeURIComponent(sid)}`,
    {
      headers: PERPLEXITY_SOCKET_HEADERS,
    },
  );
  await applyTlsCookiesToJar(jar, PERPLEXITY_HOME_URL, connectResponse.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL));

  if (connectResponse.status !== 200 || !connectResponse.body.includes("40")) {
    throw new MikaCliError("PERPLEXITY_SOCKET_CONNECT_FAILED", "Perplexity did not confirm the Socket.IO namespace connection.", {
      details: {
        status: connectResponse.status,
        body: connectResponse.body.slice(0, 200),
      },
    });
  }
}

async function sendPerplexityTextPrompt(
  session: SessionClient,
  jar: CookieJar,
  sid: string,
  prompt: string,
): Promise<void> {
  const payload = `421${JSON.stringify([
    "perplexity_ask",
    prompt,
    {
      version: "2.1",
      source: "default",
      frontend_session_id: randomUUID(),
      language: "en-US",
      timezone: "Asia/Kolkata",
      attachments: [],
      search_focus: "internet",
      frontend_uuid: randomUUID(),
      mode: "concise",
      in_page: null,
      in_domain: null,
    },
  ])}`;

  const response = await session.post(
    `${PERPLEXITY_SOCKET_IO_URL}?EIO=4&transport=polling&t=${Date.now() + 2}&sid=${encodeURIComponent(sid)}`,
    payload,
    {
      headers: PERPLEXITY_SOCKET_POST_HEADERS,
    },
  );

  await applyTlsCookiesToJar(jar, PERPLEXITY_HOME_URL, response.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL));

  if (response.status !== 200 || response.body.trim() !== "OK") {
    throw new MikaCliError("PERPLEXITY_PROMPT_REJECTED", "Perplexity rejected the prompt submission.", {
      details: {
        status: response.status,
        body: response.body.slice(0, 200),
      },
    });
  }
}

async function pollPerplexityAnswer(
  session: SessionClient,
  jar: CookieJar,
  sid: string,
): Promise<ParsedPerplexityCompletion> {
  const deadline = Date.now() + PERPLEXITY_TEXT_TIMEOUT_MS;
  const payloads: PerplexityProgressPayload[] = [];
  let finalPayloadSeen = false;
  let pollsAfterFinal = 0;

  while (Date.now() < deadline) {
    const response = await session.get(
      `${PERPLEXITY_SOCKET_IO_URL}?EIO=4&transport=polling&t=${Date.now()}&sid=${encodeURIComponent(sid)}`,
      {
        headers: PERPLEXITY_SOCKET_HEADERS,
      },
    );

    await applyTlsCookiesToJar(jar, PERPLEXITY_HOME_URL, response.headers);
    session.setDefaultCookies(await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL));

    if (response.status !== 200) {
      throw createPerplexityRequestError(response.status, response.body, PERPLEXITY_SOCKET_IO_URL);
    }

    const packets = splitPerplexityPackets(response.body);
    for (const packet of packets) {
      if (packet === "2") {
        await respondToPerplexityPing(session, jar, sid);
        continue;
      }

      const parsed = parsePerplexitySocketPacket(packet);
      if (!parsed) {
        continue;
      }

      if (parsed.kind === "error") {
        throw new MikaCliError("PERPLEXITY_QUERY_FAILED", parsed.message, {
          details: parsed.details,
        });
      }

      payloads.push(parsed.payload);
      if (isPerplexityFinalPayload(parsed.payload)) {
        finalPayloadSeen = true;
      }
    }

    if (hasPerplexityFinalAnswer(payloads)) {
      return parsePerplexityCompletionPayloads(payloads);
    }

    if (finalPayloadSeen) {
      pollsAfterFinal += 1;
      if (pollsAfterFinal >= 3) {
        return parsePerplexityCompletionPayloads(payloads);
      }
    }
  }

  throw new MikaCliError("PERPLEXITY_TIMEOUT", "Perplexity did not finish responding before the timeout.");
}

async function respondToPerplexityPing(session: SessionClient, jar: CookieJar, sid: string): Promise<void> {
  const response = await session.post(
    `${PERPLEXITY_SOCKET_IO_URL}?EIO=4&transport=polling&t=${Date.now()}&sid=${encodeURIComponent(sid)}`,
    "3",
    {
      headers: PERPLEXITY_SOCKET_POST_HEADERS,
    },
  );
  await applyTlsCookiesToJar(jar, PERPLEXITY_HOME_URL, response.headers);
  session.setDefaultCookies(await exportJarCookiesForTls(jar, PERPLEXITY_HOME_URL));
}

function parsePerplexitySocketPacket(
  packet: string,
):
  | {
      kind: "payload";
      payload: PerplexityProgressPayload;
    }
  | {
      kind: "error";
      message: string;
      details: Record<string, unknown>;
    }
  | undefined {
  if (packet.startsWith("42")) {
    const payload = safeParseJson<unknown[]>(packet.slice(2));
    if (!Array.isArray(payload) || typeof payload[0] !== "string") {
      return undefined;
    }

    const eventName = payload[0];
    const eventPayload = isRecord(payload[1]) ? (payload[1] as PerplexityProgressPayload) : undefined;
    if (!eventPayload) {
      return undefined;
    }

    if (eventName === "query_progress" || eventName === "query_answered") {
      return {
        kind: "payload",
        payload: eventPayload,
      };
    }

    if (eventName === "error") {
      return {
        kind: "error",
        message: readPerplexityErrorMessage(eventPayload) ?? "Perplexity returned an error event.",
        details: {
          eventName,
          payload: eventPayload,
        },
      };
    }

    return undefined;
  }

  if (packet.startsWith("43")) {
    const jsonStart = Math.min(...[packet.indexOf("["), packet.indexOf("{")].filter((index) => index >= 0));
    if (!Number.isFinite(jsonStart)) {
      return undefined;
    }

    const parsed = safeParseJson<unknown>(packet.slice(jsonStart));
    const payload = Array.isArray(parsed) ? parsed[0] : parsed;
    if (isRecord(payload)) {
      return {
        kind: "payload",
        payload: payload as PerplexityProgressPayload,
      };
    }
  }

  return undefined;
}

export function parsePerplexityCompletionPayloads(payloads: readonly PerplexityProgressPayload[]): ParsedPerplexityCompletion {
  const finalPayload =
    [...payloads].reverse().find((payload) => isPerplexityFinalPayload(payload)) ??
    [...payloads].reverse().find((payload) => extractPerplexityTextFromBlocks(payload.blocks).length > 0) ??
    payloads[payloads.length - 1];

  if (!finalPayload) {
    throw new MikaCliError("PERPLEXITY_EMPTY_RESPONSE", "Perplexity did not emit any completion payloads.");
  }

  const parsedAnswer =
    [...payloads]
      .reverse()
      .map((payload) => parsePerplexityFinalAnswer(payload.text))
      .find((value): value is NonNullable<ReturnType<typeof parsePerplexityFinalAnswer>> => Boolean(value)) ?? null;
  const outputText =
    parsedAnswer?.structuredAnswerText ??
    parsedAnswer?.answerText ??
    extractBestPerplexityTextFromPayloads(payloads) ??
    "";
  const answerModes = dedupeValues(
    payloads.flatMap((payload) =>
      Array.isArray(payload.answer_modes)
        ? payload.answer_modes
            .map((answerMode) => answerMode.answer_mode_type)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        : [],
    ),
  );

  return {
    outputText: outputText.trim(),
    model: findLatestPerplexityString(payloads, "display_model") ?? PERPLEXITY_DEFAULT_MODEL,
    mode: findLatestPerplexityString(payloads, "mode") ?? "CONCISE",
    searchFocus: findLatestPerplexityString(payloads, "search_focus") ?? "internet",
    queryId: findLatestPerplexityString(payloads, "uuid"),
    backendUuid: findLatestPerplexityString(payloads, "backend_uuid"),
    threadUrlSlug: findLatestPerplexityString(payloads, "thread_url_slug"),
    answerModes,
    webResults: parsedAnswer?.webResults ?? [],
  };
}

function parsePerplexityFinalAnswer(raw: string | undefined): {
  answerText?: string;
  structuredAnswerText?: string;
  webResults: unknown[];
} | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  const steps = safeParseJson<unknown>(raw);
  if (!Array.isArray(steps)) {
    return null;
  }

  const finalStep = steps.find(
    (step) =>
      isRecord(step) &&
      step.step_type === "FINAL" &&
      isRecord(step.content) &&
      typeof step.content.answer === "string",
  ) as { content: { answer: string } } | undefined;
  if (!finalStep) {
    return null;
  }

  const answer = safeParseJson<PerplexityFinalAnswerRecord>(finalStep.content.answer);
  if (!answer || typeof answer !== "object") {
    return null;
  }

  const structuredAnswerText = Array.isArray(answer.structured_answer)
    ? answer.structured_answer.find((block) => block?.type === "markdown" && typeof block.text === "string")?.text
    : undefined;

  return {
    answerText: typeof answer.answer === "string" ? answer.answer : undefined,
    structuredAnswerText,
    webResults: Array.isArray(answer.web_results) ? answer.web_results : [],
  };
}

function hasPerplexityFinalAnswer(payloads: readonly PerplexityProgressPayload[]): boolean {
  return payloads.some((payload) => Boolean(parsePerplexityFinalAnswer(payload.text)));
}

function extractPerplexityTextFromBlocks(blocks: PerplexityProgressPayload["blocks"]): string {
  if (!Array.isArray(blocks)) {
    return "";
  }

  const collected: string[] = [];
  for (const block of blocks) {
    const markdownBlock = block?.markdown_block;
    if (!markdownBlock) {
      continue;
    }

    if (typeof markdownBlock.text === "string" && markdownBlock.text.trim()) {
      collected.push(markdownBlock.text);
      continue;
    }

    if (Array.isArray(markdownBlock.chunks)) {
      collected.push(markdownBlock.chunks.join(""));
    }
  }

  return dedupeValues(collected)
    .join("")
    .trim();
}

function extractBestPerplexityTextFromPayloads(payloads: readonly PerplexityProgressPayload[]): string {
  let selected = "";
  const positionedChunks = new Map<number, string>();

  for (const payload of payloads) {
    const candidate = extractPerplexityTextFromBlocks(payload.blocks);
    if (candidate.length > selected.length) {
      selected = candidate;
    }

    if (!Array.isArray(payload.blocks)) {
      continue;
    }

    for (const block of payload.blocks) {
      const markdownBlock = block?.markdown_block;
      if (!markdownBlock || !Array.isArray(markdownBlock.chunks) || markdownBlock.chunks.length === 0) {
        continue;
      }

      const chunkText = markdownBlock.chunks.join("");
      const offset = typeof markdownBlock.chunk_starting_offset === "number" ? markdownBlock.chunk_starting_offset : undefined;
      if (typeof offset !== "number") {
        continue;
      }

      const existing = positionedChunks.get(offset);
      if (!existing || chunkText.length > existing.length) {
        positionedChunks.set(offset, chunkText);
      }
    }
  }

  if (positionedChunks.size === 0) {
    return selected;
  }

  const assembled: string[] = [];
  for (const [offset, chunkText] of [...positionedChunks.entries()].sort((left, right) => left[0] - right[0])) {
    for (let index = 0; index < chunkText.length; index += 1) {
      const character = chunkText[index];
      if (typeof character === "string") {
        assembled[offset + index] = character;
      }
    }
  }

  const merged = assembled.join("").trim();
  return merged.length >= selected.length ? merged : selected;
}

function isPerplexityFinalPayload(payload: PerplexityProgressPayload): boolean {
  return payload.final === true || payload.status === "COMPLETED";
}

function createPerplexityTransportToken(): string {
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

function splitPerplexityPackets(body: string): string[] {
  return body
    .split("\u001e")
    .map((packet) => packet.trim())
    .filter((packet) => packet.length > 0);
}

function readPerplexitySubscriptionTier(
  user: NonNullable<PerplexityAuthSessionResponse["user"]> | undefined,
): string | undefined {
  return [user?.subscription_tier, user?.payment_tier, user?.subscription_status].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function toPerplexitySessionUser(user: NonNullable<PerplexityAuthSessionResponse["user"]> | undefined): SessionUser | undefined {
  if (!user?.id) {
    return undefined;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.name ?? user.username ?? user.email,
  };
}

function mapPerplexityError(error: unknown, fallbackMessage: string): MikaCliError {
  if (isMikaCliError(error)) {
    return error;
  }

  return new MikaCliError("PERPLEXITY_REQUEST_FAILED", fallbackMessage, {
    cause: error,
    details: {
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

function createPerplexityRequestError(status: number, body: string, url: string): MikaCliError {
  const preview = body.slice(0, 400);
  if (status === 401) {
    return new MikaCliError("SESSION_EXPIRED", "Perplexity session expired. Re-import cookies.", {
      details: {
        url,
        status,
      },
    });
  }

  if (status === 403 && /just a moment|security verification|cloudflare/iu.test(body)) {
    return new MikaCliError(
      "PERPLEXITY_ANTI_BOT_BLOCKED",
      "Perplexity rejected the browserless request with its current anti-bot rules.",
      {
        details: {
          url,
          status,
          body: preview,
        },
      },
    );
  }

  return new MikaCliError("PERPLEXITY_REQUEST_FAILED", `Perplexity request failed with ${status}.`, {
    details: {
      url,
      status,
      body: preview,
    },
  });
}

function readPerplexityErrorMessage(payload: PerplexityProgressPayload): string | undefined {
  if (typeof payload.text === "string" && payload.text.trim()) {
    return payload.text;
  }

  return undefined;
}

function findLatestPerplexityString(payloads: readonly PerplexityProgressPayload[], key: keyof PerplexityProgressPayload): string | undefined {
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    const value = payloads[index]?.[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
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

function dedupeValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

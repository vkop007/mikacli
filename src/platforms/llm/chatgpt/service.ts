import { createHash, randomInt, randomUUID } from "node:crypto";

import { AutoCliError, isAutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { readImageMetadata } from "../../../utils/image-metadata.js";
import { readMediaFile } from "../../../utils/media.js";

import type { SessionHttpClient as SessionHttpClientType } from "../../../utils/http-client.js";
import type { SessionStatus, SessionUser } from "../../../types.js";

const CHATGPT_HOME_URL = "https://chatgpt.com/";
const CHATGPT_BACKEND_ME_URL = "https://chatgpt.com/backend-api/me";
const CHATGPT_AUTH_SESSION_URL = "https://chatgpt.com/api/auth/session";
const CHATGPT_AUTH_CSRF_URL = "https://chatgpt.com/api/auth/csrf";
const CHATGPT_CF_JSD_MAIN_URL = "https://chatgpt.com/cdn-cgi/challenge-platform/scripts/jsd/main.js";
const CHATGPT_REQUIREMENTS_URL = "https://chatgpt.com/backend-anon/sentinel/chat-requirements";
const CHATGPT_FILES_URL = "https://chatgpt.com/backend-anon/files";
const CHATGPT_PROCESS_UPLOAD_URL = "https://chatgpt.com/backend-anon/files/process_upload_stream";
const CHATGPT_CONVERSATION_URL = "https://chatgpt.com/backend-anon/conversation";
const CHATGPT_AUTH_REQUIREMENTS_PREPARE_URL = "https://chatgpt.com/backend-api/sentinel/chat-requirements/prepare";
const CHATGPT_AUTH_REQUIREMENTS_FINALIZE_URL = "https://chatgpt.com/backend-api/sentinel/chat-requirements/finalize";
const CHATGPT_AUTH_CONVERSATION_PREPARE_URL = "https://chatgpt.com/backend-api/f/conversation/prepare";
const CHATGPT_AUTH_CONVERSATION_URL = "https://chatgpt.com/backend-api/f/conversation";

const CHATGPT_DEFAULT_MODEL = "auto";
const CHATGPT_ANON_BROWSER = {
  agent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  platform: "Windows",
  mobile: "?0",
  ua: 'Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132',
} as const;
const CHATGPT_AUTH_BROWSER = {
  agent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  platform: "macOS",
  mobile: "?0",
  ua: '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
} as const;

interface ChatGptAuthSessionResponse {
  accessToken?: string;
  sessionToken?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
}

interface ChatGptCsrfResponse {
  csrfToken?: string;
}

interface ChatGptRequirementsResponse {
  token?: string;
  prepare_token?: string;
  proofofwork?: {
    required?: boolean;
    seed?: string;
    difficulty?: string;
  };
}

interface ChatGptAuthenticatedConversationPrepareResponse {
  conduit_token?: string;
}

interface ChatGptAnonymousSession {
  deviceId: string;
  csrfToken: string;
  requirementsToken: string;
  proofToken: string;
  oaiSc: string;
}

interface ChatGptFileUploadResponse {
  file_id?: string;
  upload_url?: string;
}

interface ChatGptUploadedImage {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface ChatGptInspectionResult {
  status: SessionStatus;
  user?: SessionUser;
  backendAccessible?: boolean;
}

export interface ChatGptTextExecutionResult {
  outputText: string;
  conversationId?: string;
  messageId?: string;
  model: string;
  mode: "anonymous-web" | "authenticated-web";
}

export interface ChatGptImageExecutionResult extends ChatGptTextExecutionResult {
  fileId: string;
}

export interface ChatGptParsedStream {
  outputText: string;
  conversationId?: string;
  assistantMessageId?: string;
  model?: string;
}

export class ChatGptService {
  async inspectSession(client: SessionHttpClientType): Promise<ChatGptInspectionResult> {
    try {
      const session = await this.fetchAuthSession(client);
      const user = toChatGptUser(session);
      const authenticated = typeof session.accessToken === "string" || typeof session.sessionToken === "string";

      if (!authenticated) {
        return {
          status: {
            state: "expired",
            message: "ChatGPT session expired. Re-import cookies.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "SESSION_EXPIRED",
          },
        };
      }

      const backendAccessible = await this.probeAuthenticatedBackend(client).catch(() => false);
      return {
        status: {
          state: "active",
          message: backendAccessible
            ? "ChatGPT session is active. Browserless backend bootstrap is available."
            : "ChatGPT session is active, but authenticated backend bootstrap could not complete. Browserless prompts will continue using the anonymous fallback.",
          lastValidatedAt: new Date().toISOString(),
        },
        user,
        backendAccessible,
      };
    } catch (error) {
      if (isChatGptExpiredError(error)) {
        return {
          status: {
            state: "expired",
            message: "ChatGPT session expired. Re-import cookies.",
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
    input: {
      prompt: string;
      model?: string;
    },
  ): Promise<ChatGptTextExecutionResult> {
    try {
      const client = new SessionHttpClient();
      const anonymousSession = await this.initializeAnonymousSession(client);
      const conversationStream = await this.sendConversation(client, {
        body: buildChatGptTextConversationBody(input.prompt, input.model?.trim() || CHATGPT_DEFAULT_MODEL),
        ...anonymousSession,
      });
      const parsed = parseChatGptConversationStream(conversationStream);

      if (!parsed.outputText) {
        throw new AutoCliError("CHATGPT_EMPTY_RESPONSE", "ChatGPT returned an empty response.");
      }

      return {
        outputText: parsed.outputText,
        conversationId: parsed.conversationId,
        messageId: parsed.assistantMessageId,
        model: parsed.model ?? CHATGPT_DEFAULT_MODEL,
        mode: "anonymous-web",
      };
    } catch (error) {
      throw mapChatGptError(error, "Failed to complete the ChatGPT prompt.");
    }
  }

  async executeAuthenticatedText(
    client: SessionHttpClientType,
    input: {
      prompt: string;
      model?: string;
    },
  ): Promise<ChatGptTextExecutionResult> {
    try {
      const model = input.model?.trim() || CHATGPT_DEFAULT_MODEL;
      const bootstrap = await this.initializeAuthenticatedConversation(client, model);
      const conversationStream = await this.sendAuthenticatedConversation(client, {
        body: buildChatGptAuthenticatedTextConversationBody({
          prompt: input.prompt,
          model,
          parentMessageId: bootstrap.parentMessageId,
        }),
        deviceId: bootstrap.deviceId,
        turnTraceId: bootstrap.turnTraceId,
        conduitToken: bootstrap.conduitToken,
        requirementsToken: bootstrap.requirementsToken,
        proofToken: bootstrap.proofToken,
      });
      const parsed = parseChatGptConversationStream(conversationStream);

      if (!parsed.outputText) {
        throw new AutoCliError("CHATGPT_EMPTY_RESPONSE", "ChatGPT returned an empty response.");
      }

      return {
        outputText: parsed.outputText,
        conversationId: parsed.conversationId,
        messageId: parsed.assistantMessageId,
        model: parsed.model ?? model,
        mode: "authenticated-web",
      };
    } catch (error) {
      throw mapChatGptError(error, "Failed to complete the ChatGPT prompt.");
    }
  }

  async executeImage(
    input: {
      mediaPath: string;
      caption?: string;
      model?: string;
    },
  ): Promise<ChatGptImageExecutionResult> {
    try {
      const media = await readMediaFile(input.mediaPath);
      const metadata = readImageMetadata(media.bytes, media.mimeType);
      const client = new SessionHttpClient();
      const anonymousSession = await this.initializeAnonymousSession(client);
      const uploadedImage = await this.uploadImage(client, anonymousSession, {
        filename: media.filename,
        mimeType: media.mimeType,
        bytes: media.bytes,
        sizeBytes: media.bytes.byteLength,
        width: metadata.width,
        height: metadata.height,
      });
      const prompt = input.caption?.trim() || "Describe this image.";
      const conversationStream = await this.sendConversation(client, {
        body: buildChatGptImageConversationBody({
          prompt,
          model: input.model?.trim() || CHATGPT_DEFAULT_MODEL,
          image: uploadedImage,
        }),
        ...anonymousSession,
      });
      const parsed = parseChatGptConversationStream(conversationStream);

      if (!parsed.outputText) {
        throw new AutoCliError("CHATGPT_EMPTY_RESPONSE", "ChatGPT returned an empty response for the image prompt.");
      }

      return {
        outputText: parsed.outputText,
        conversationId: parsed.conversationId,
        messageId: parsed.assistantMessageId,
        model: parsed.model ?? CHATGPT_DEFAULT_MODEL,
        mode: "anonymous-web",
        fileId: uploadedImage.fileId,
      };
    } catch (error) {
      throw mapChatGptError(error, "Failed to complete the ChatGPT image prompt.");
    }
  }

  private async probeAuthenticatedBackend(client: SessionHttpClientType): Promise<boolean> {
    const deviceId = await ensureChatGptDeviceId(client);
    await this.refreshAuthenticatedCsrfCookie(client);
    await this.refreshCloudflareChallengeCookies(client);

    const response = await client.requestWithResponse<string>(CHATGPT_BACKEND_ME_URL, {
      headers: buildChatGptBrowserHeaders({
        accept: "application/json, text/plain, */*",
        deviceId,
      }),
      expectedStatus: [200, 401],
      responseType: "text",
    });

    return response.response.status === 200;
  }

  private async initializeAnonymousSession(client: SessionHttpClientType): Promise<ChatGptAnonymousSession> {
    const deviceId = randomUUID();
    const csrfToken = await this.fetchCsrfToken(client, deviceId);
    const requirements = await this.fetchChatRequirements(client, deviceId, csrfToken);
    const proofToken = solveChatGptSentinelChallenge(
      requirements.proofofwork.seed,
      requirements.proofofwork.difficulty,
    );

    return {
      deviceId,
      csrfToken,
      requirementsToken: requirements.token,
      proofToken,
      oaiSc: requirements.oaiSc,
    };
  }

  private async initializeAuthenticatedConversation(client: SessionHttpClientType, model: string): Promise<{
    deviceId: string;
    turnTraceId: string;
    parentMessageId: string;
    conduitToken: string;
    requirementsToken: string;
    proofToken?: string;
  }> {
    const deviceId = await ensureChatGptDeviceId(client);
    await this.refreshAuthenticatedCsrfCookie(client);
    await this.refreshCloudflareChallengeCookies(client);

    const { requirementsToken, proofToken } = await this.fetchAuthenticatedChatRequirements(client, deviceId);
    const turnTraceId = randomUUID();
    const parentMessageId = "client-created-root";
    const prepare = await this.prepareAuthenticatedConversation(client, {
      body: buildChatGptAuthenticatedConversationPrepareBody({
        parentMessageId,
        model,
      }),
      deviceId,
      turnTraceId,
      requirementsToken,
      proofToken,
    });

    return {
      deviceId,
      turnTraceId,
      parentMessageId,
      conduitToken: prepare.conduitToken,
      requirementsToken,
      proofToken,
    };
  }

  private async fetchAuthSession(client: SessionHttpClientType): Promise<ChatGptAuthSessionResponse> {
    const { data } = await client.requestWithResponse<ChatGptAuthSessionResponse>(CHATGPT_AUTH_SESSION_URL, {
      headers: {
        origin: "https://chatgpt.com",
        referer: "https://chatgpt.com/",
        "user-agent": CHATGPT_ANON_BROWSER.agent,
        accept: "*/*",
      },
      expectedStatus: [200, 401],
    });

    return data;
  }

  private async fetchCsrfToken(client: SessionHttpClientType, deviceId: string): Promise<string> {
    const response = await client.request<ChatGptCsrfResponse>(CHATGPT_AUTH_CSRF_URL, {
      headers: buildChatGptBypassHeaders({
        accept: "application/json",
        deviceId,
        spoofAddress: true,
      }),
      expectedStatus: 200,
    });

    if (typeof response.csrfToken !== "string" || response.csrfToken.length === 0) {
      throw new AutoCliError("CHATGPT_CSRF_MISSING", "ChatGPT did not return a CSRF token.");
    }

    return response.csrfToken;
  }

  private async refreshAuthenticatedCsrfCookie(client: SessionHttpClientType): Promise<void> {
    const response = await client.request<ChatGptCsrfResponse>(CHATGPT_AUTH_CSRF_URL, {
      headers: buildChatGptBrowserHeaders({
        accept: "application/json",
      }),
      expectedStatus: 200,
    });

    if (typeof response.csrfToken !== "string" || response.csrfToken.length === 0) {
      return;
    }

    await client.jar.setCookie(
      `__Host-next-auth.csrf-token=${response.csrfToken}; Domain=chatgpt.com; Path=/; Secure; HttpOnly; SameSite=Lax`,
      CHATGPT_HOME_URL,
    );
  }

  private async refreshCloudflareChallengeCookies(client: SessionHttpClientType): Promise<void> {
    const html = await client.request<string>(CHATGPT_HOME_URL, {
      headers: buildChatGptBrowserHeaders({
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      }),
      responseType: "text",
      expectedStatus: 200,
    });

    const requestId = extractChatGptCloudflareRequestId(html);
    if (!requestId) {
      return;
    }

    const script = await client.request<string>(CHATGPT_CF_JSD_MAIN_URL, {
      headers: buildChatGptBrowserHeaders({
        accept: "*/*",
      }),
      responseType: "text",
      expectedStatus: 200,
    });

    const challengePath = extractChatGptCloudflareChallengePath(script);
    if (!challengePath) {
      return;
    }

    const url = buildChatGptCloudflareOneShotUrl(requestId, challengePath);
    await client.request<string>(url, {
      method: "POST",
      headers: buildChatGptBrowserHeaders({
        accept: "*/*",
      }),
      responseType: "text",
      expectedStatus: [200, 204],
    });
  }

  private async fetchChatRequirements(
    client: SessionHttpClientType,
    deviceId: string,
    csrfToken: string,
  ): Promise<
    ChatGptRequirementsResponse & {
      token: string;
      proofofwork: {
        required?: boolean;
        seed: string;
        difficulty: string;
      };
      oaiSc: string;
    }
  > {
    const { data, response } = await client.requestWithResponse<ChatGptRequirementsResponse>(CHATGPT_REQUIREMENTS_URL, {
      method: "POST",
      headers: {
        ...buildChatGptBypassHeaders({
          accept: "application/json",
          deviceId,
          spoofAddress: true,
        }),
        cookie: buildChatGptCookieHeader({
          csrfToken,
          deviceId,
        }),
      },
      body: JSON.stringify({
        p: generateFakeSentinelToken(),
      }),
      expectedStatus: 200,
    });

    if (!data || typeof data.token !== "string" || !data.proofofwork?.seed || !data.proofofwork.difficulty) {
      throw new AutoCliError("CHATGPT_REQUIREMENTS_FAILED", "ChatGPT did not return the anonymous sentinel requirements.", {
        details: {
          hasToken: typeof data?.token === "string",
          hasProofSeed: typeof data?.proofofwork?.seed === "string",
          hasDifficulty: typeof data?.proofofwork?.difficulty === "string",
        },
      });
    }

    const oaiSc = extractCookieValueFromResponse(response, "oai-sc");
    if (!oaiSc) {
      throw new AutoCliError("CHATGPT_OAI_SC_MISSING", "ChatGPT did not return the required anonymous session cookie.");
    }

    return {
      ...data,
      token: data.token,
      proofofwork: {
        ...data.proofofwork,
        seed: data.proofofwork.seed,
        difficulty: data.proofofwork.difficulty,
      },
      oaiSc,
    };
  }

  private async fetchAuthenticatedChatRequirements(
    client: SessionHttpClientType,
    deviceId: string,
  ): Promise<{
    requirementsToken: string;
    proofToken?: string;
  }> {
    const prepared = await client.request<ChatGptRequirementsResponse>(CHATGPT_AUTH_REQUIREMENTS_PREPARE_URL, {
      method: "POST",
      headers: buildChatGptAuthenticatedHeaders({
        accept: "application/json, text/plain, */*",
        deviceId,
        targetPath: "/backend-api/sentinel/chat-requirements/prepare",
      }),
      body: JSON.stringify({
        p: generateFakeSentinelToken(),
      }),
      expectedStatus: 200,
    });

    const prepareToken = prepared.prepare_token ?? prepared.token;
    if (!prepareToken) {
      throw new AutoCliError(
        "CHATGPT_REQUIREMENTS_FAILED",
        "ChatGPT did not return the authenticated sentinel requirements token.",
      );
    }

    const proofToken =
      prepared.proofofwork?.seed && prepared.proofofwork?.difficulty
        ? solveChatGptSentinelChallenge(prepared.proofofwork.seed, prepared.proofofwork.difficulty)
        : undefined;
    const finalized = await client.request<ChatGptRequirementsResponse>(CHATGPT_AUTH_REQUIREMENTS_FINALIZE_URL, {
      method: "POST",
      headers: buildChatGptAuthenticatedHeaders({
        accept: "application/json, text/plain, */*",
        deviceId,
        targetPath: "/backend-api/sentinel/chat-requirements/finalize",
      }),
      body: JSON.stringify({
        prepare_token: prepareToken,
        ...(proofToken ? { proofofwork: proofToken } : {}),
      }),
      expectedStatus: 200,
    });

    const requirementsToken = finalized.token ?? prepareToken;
    if (!requirementsToken) {
      throw new AutoCliError(
        "CHATGPT_REQUIREMENTS_FAILED",
        "ChatGPT did not return the finalized authenticated chat requirements token.",
      );
    }

    return {
      requirementsToken,
      proofToken,
    };
  }

  private async prepareAuthenticatedConversation(
    client: SessionHttpClientType,
    input: {
      body: Record<string, unknown>;
      deviceId: string;
      turnTraceId: string;
      requirementsToken: string;
      proofToken?: string;
    },
  ): Promise<{
    conduitToken: string;
  }> {
    const response = await client.request<ChatGptAuthenticatedConversationPrepareResponse>(
      CHATGPT_AUTH_CONVERSATION_PREPARE_URL,
      {
        method: "POST",
        headers: buildChatGptAuthenticatedHeaders({
          accept: "application/json, text/plain, */*",
          deviceId: input.deviceId,
          targetPath: "/backend-api/f/conversation/prepare",
          turnTraceId: input.turnTraceId,
          conduitToken: "no-token",
          requirementsToken: input.requirementsToken,
          proofToken: input.proofToken,
        }),
        body: JSON.stringify(input.body),
        expectedStatus: 200,
      },
    );

    if (!response.conduit_token) {
      throw new AutoCliError(
        "CHATGPT_CONDUIT_TOKEN_MISSING",
        "ChatGPT did not return the conduit token required for authenticated prompts.",
      );
    }

    return {
      conduitToken: response.conduit_token,
    };
  }

  private async sendAuthenticatedConversation(
    client: SessionHttpClientType,
    input: {
      body: Record<string, unknown>;
      deviceId: string;
      turnTraceId: string;
      conduitToken: string;
      requirementsToken: string;
      proofToken?: string;
    },
  ): Promise<string> {
    return client.request<string>(CHATGPT_AUTH_CONVERSATION_URL, {
      method: "POST",
      headers: buildChatGptAuthenticatedHeaders({
        accept: "text/event-stream",
        deviceId: input.deviceId,
        targetPath: "/backend-api/f/conversation",
        turnTraceId: input.turnTraceId,
        conduitToken: input.conduitToken,
        requirementsToken: input.requirementsToken,
        proofToken: input.proofToken,
      }),
      body: JSON.stringify(input.body),
      responseType: "text",
      expectedStatus: 200,
    });
  }

  private async sendConversation(
    client: SessionHttpClientType,
    input: {
      body: Record<string, unknown>;
      deviceId: string;
      csrfToken: string;
      requirementsToken: string;
      proofToken: string;
      oaiSc: string;
    },
  ): Promise<string> {
    return client.request<string>(CHATGPT_CONVERSATION_URL, {
      method: "POST",
      headers: {
        ...buildChatGptBypassHeaders({
          accept: "text/event-stream",
          deviceId: input.deviceId,
          spoofAddress: true,
        }),
        cookie: buildChatGptCookieHeader({
          csrfToken: input.csrfToken,
          deviceId: input.deviceId,
          oaiSc: input.oaiSc,
        }),
        "openai-sentinel-chat-requirements-token": input.requirementsToken,
        "openai-sentinel-proof-token": input.proofToken,
      },
      body: JSON.stringify(input.body),
      responseType: "text",
      expectedStatus: [200, 403, 429],
    });
  }

  private async uploadImage(
    client: SessionHttpClientType,
    session: ChatGptAnonymousSession,
    image: {
      filename: string;
      mimeType: string;
      bytes: Buffer;
      sizeBytes: number;
      width: number;
      height: number;
    },
  ): Promise<ChatGptUploadedImage> {
    const file = await client.request<ChatGptFileUploadResponse>(CHATGPT_FILES_URL, {
      method: "POST",
      headers: {
        ...buildChatGptBypassHeaders({
          accept: "application/json, text/plain, */*",
          deviceId: session.deviceId,
          spoofAddress: true,
        }),
        cookie: buildChatGptCookieHeader({
          csrfToken: session.csrfToken,
          deviceId: session.deviceId,
          oaiSc: session.oaiSc,
        }),
      },
      body: JSON.stringify({
        file_name: image.filename,
        file_size: image.sizeBytes,
        use_case: "multimodal",
        timezone_offset_min: getLocalTimezoneOffsetMinutes(),
        reset_rate_limits: false,
      }),
      expectedStatus: 200,
    });

    if (!file.file_id || !file.upload_url) {
      throw new AutoCliError("CHATGPT_FILE_UPLOAD_INIT_FAILED", "ChatGPT did not return an upload URL for the image.");
    }

    await client.request<string>(file.upload_url, {
      method: "PUT",
      headers: buildChatGptBlobUploadHeaders(image.mimeType),
      body: new Uint8Array(image.bytes),
      responseType: "text",
      expectedStatus: [200, 201],
    });

    const processStream = await client.request<string>(CHATGPT_PROCESS_UPLOAD_URL, {
      method: "POST",
      headers: {
        ...buildChatGptBypassHeaders({
          accept: "text/event-stream",
          deviceId: session.deviceId,
          spoofAddress: true,
        }),
        cookie: buildChatGptCookieHeader({
          csrfToken: session.csrfToken,
          deviceId: session.deviceId,
          oaiSc: session.oaiSc,
        }),
      },
      body: JSON.stringify({
        file_id: file.file_id,
        use_case: "multimodal",
        index_for_retrieval: false,
        file_name: image.filename,
      }),
      responseType: "text",
      expectedStatus: 200,
    });

    if (!/file\.processing\.completed|Succeeded processing /u.test(processStream)) {
      throw new AutoCliError("CHATGPT_FILE_PROCESSING_FAILED", "ChatGPT did not finish processing the uploaded image.", {
        details: {
          fileId: file.file_id,
          preview: processStream.slice(0, 400),
        },
      });
    }

    return {
      fileId: file.file_id,
      filename: image.filename,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
    };
  }
}

export function generateFakeSentinelToken(): string {
  const config = [
    randomInt(3000, 6000),
    new Date().toUTCString().replace("GMT", "GMT+0100 (Central European Time)"),
    4294705152,
    0,
    CHATGPT_ANON_BROWSER.agent,
    "de",
    "de",
    401,
    "mediaSession",
    "location",
    "scrollX",
    randomFloat(1000, 5000),
    randomUUID(),
    "",
    12,
    Date.now(),
  ];

  return `gAAAAAC${Buffer.from(JSON.stringify(config)).toString("base64")}`;
}

export function solveChatGptSentinelChallenge(seed: string, difficulty: string): string {
  const cores = [8, 12, 16, 24];
  const screens = [3000, 4000, 6000];
  const core = cores[randomInt(0, cores.length)] ?? 16;
  const screen = screens[randomInt(0, screens.length)] ?? 4000;
  const now = new Date(Date.now() - 8 * 3_600 * 1_000);
  const parseTime = now.toUTCString().replace("GMT", "GMT+0100 (Central European Time)");
  const config: [number, string, number, number, string] = [
    core + screen,
    parseTime,
    4_294_705_152,
    0,
    CHATGPT_ANON_BROWSER.agent,
  ];
  const difficultyLength = Math.max(1, difficulty.length / 2);

  for (let index = 0; index < 100_000; index += 1) {
    config[3] = index;
    const base = Buffer.from(JSON.stringify(config)).toString("base64");
    const hash = createHash("sha3-512").update(seed + base).digest("hex");
    if (hash.slice(0, difficultyLength) <= difficulty) {
      return `gAAAAAB${base}`;
    }
  }

  throw new AutoCliError(
    "CHATGPT_PROOF_UNSOLVED",
    "ChatGPT's browserless proof-of-work challenge could not be solved within the current retry budget.",
    {
      details: {
        difficulty,
      },
    },
  );
}

export function parseChatGptConversationStream(stream: string): ChatGptParsedStream {
  let outputText = "";
  let conversationId: string | undefined;
  let assistantMessageId: string | undefined;
  let model: string | undefined;

  for (const rawLine of stream.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) {
      continue;
    }

    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      continue;
    }

    if (typeof parsed === "string") {
      continue;
    }

    if (!parsed || typeof parsed !== "object") {
      continue;
    }

    const record = parsed as Record<string, unknown>;
    const candidateConversationId = readString(record.conversation_id);
    if (candidateConversationId) {
      conversationId = candidateConversationId;
    }

    const message = readObject(record.message);
    if (message) {
      const author = readObject(message.author);
      const authorRole = readString(author?.role);
      const content = readObject(message.content);
      const parts = Array.isArray(content?.parts) ? content.parts : [];

      if (authorRole === "assistant") {
        const textPart = parts.find((part) => typeof part === "string");
        if (typeof textPart === "string") {
          outputText = textPart;
        }
        assistantMessageId = readString(message.id) ?? assistantMessageId;
        model = readString(readObject(message.metadata)?.resolved_model_slug) ?? model;
      }
    }

    const value = readObject(record.v);
    const nestedMessage = readObject(value?.message);
    if (nestedMessage) {
      const author = readObject(nestedMessage.author);
      if (readString(author?.role) === "assistant") {
        const content = readObject(nestedMessage.content);
        const parts = Array.isArray(content?.parts) ? content.parts : [];
        const textPart = parts.find((part) => typeof part === "string");
        if (typeof textPart === "string") {
          outputText = textPart;
        }
        assistantMessageId = readString(nestedMessage.id) ?? assistantMessageId;
        model = readString(readObject(nestedMessage.metadata)?.resolved_model_slug) ?? model;
      }
      conversationId = readString(value?.conversation_id) ?? conversationId;
    }

    if (record.o === "append" && record.p === "/message/content/parts/0" && typeof record.v === "string") {
      outputText += record.v;
    }

    if (Array.isArray(record.v)) {
      for (const operation of record.v) {
        if (!operation || typeof operation !== "object") {
          continue;
        }
        const patch = operation as Record<string, unknown>;
        if (patch.o === "append" && patch.p === "/message/content/parts/0" && typeof patch.v === "string") {
          outputText += patch.v;
        }
      }
    }
  }

  return {
    outputText: outputText.trim(),
    conversationId,
    assistantMessageId,
    model,
  };
}

function buildChatGptBypassHeaders(input: {
  accept: string;
  deviceId: string;
  spoofAddress: boolean;
}): Record<string, string> {
  const ip = randomIp();
  return {
    accept: input.accept,
    "content-type": "application/json",
    "cache-control": "no-cache",
    referer: "https://chatgpt.com/",
    "referrer-policy": "strict-origin-when-cross-origin",
    "oai-device-id": input.deviceId,
    "oai-language": "en",
    "user-agent": CHATGPT_ANON_BROWSER.agent,
    pragma: "no-cache",
    priority: "u=1, i",
    "sec-ch-ua": `"${CHATGPT_ANON_BROWSER.ua}"`,
    "sec-ch-ua-mobile": CHATGPT_ANON_BROWSER.mobile,
    "sec-ch-ua-platform": `"${CHATGPT_ANON_BROWSER.platform}"`,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    ...(input.spoofAddress
      ? {
          "x-forwarded-for": ip,
          "x-originating-ip": ip,
          "x-remote-ip": ip,
          "x-remote-addr": ip,
          "x-host": ip,
          "x-forwarded-host": ip,
          forwarded: `for=${ip}`,
          "true-client-ip": ip,
          "x-real-ip": ip,
        }
      : {}),
  };
}

function buildChatGptBrowserHeaders(input: {
  accept: string;
  deviceId?: string;
}): Record<string, string> {
  return {
    accept: input.accept,
    origin: "https://chatgpt.com",
    referer: "https://chatgpt.com/",
    "user-agent": CHATGPT_ANON_BROWSER.agent,
    "oai-language": "en-US",
    ...(input.deviceId ? { "oai-device-id": input.deviceId } : {}),
  };
}

function buildChatGptAuthenticatedHeaders(input: {
  accept: string;
  deviceId: string;
  targetPath: string;
  turnTraceId?: string;
  conduitToken?: string;
  requirementsToken?: string;
  proofToken?: string;
}): Record<string, string> {
  return {
    accept: input.accept,
    origin: "https://chatgpt.com",
    referer: "https://chatgpt.com/",
    "content-type": "application/json",
    "user-agent": CHATGPT_AUTH_BROWSER.agent,
    "oai-language": "en-US",
    "oai-device-id": input.deviceId,
    "sec-ch-ua": CHATGPT_AUTH_BROWSER.ua,
    "sec-ch-ua-mobile": CHATGPT_AUTH_BROWSER.mobile,
    "sec-ch-ua-platform": `"${CHATGPT_AUTH_BROWSER.platform}"`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-openai-target-route": input.targetPath,
    "x-openai-target-path": input.targetPath,
    ...(input.turnTraceId ? { "x-oai-turn-trace-id": input.turnTraceId } : {}),
    ...(input.conduitToken ? { "x-conduit-token": input.conduitToken } : {}),
    ...(input.requirementsToken
      ? {
          "OpenAI-Sentinel-Chat-Requirements-Token": input.requirementsToken,
        }
      : {}),
    ...(input.proofToken
      ? {
          "OpenAI-Sentinel-Proof-Token": input.proofToken,
        }
      : {}),
  };
}

function buildChatGptCookieHeader(input: {
  csrfToken: string;
  deviceId: string;
  oaiSc?: string;
}): string {
  const parts = [
    `__Host-next-auth.csrf-token=${input.csrfToken}`,
    `oai-did=${input.deviceId}`,
    "oai-nav-state=1",
  ];

  if (input.oaiSc) {
    parts.push(`oai-sc=${input.oaiSc}`);
  }

  return `${parts.join("; ")};`;
}

function buildChatGptTextConversationBody(prompt: string, model: string): Record<string, unknown> {
  return buildChatGptConversationBody({
    message: {
      id: randomUUID(),
      author: {
        role: "user",
      },
      create_time: Date.now(),
      content: {
        content_type: "text",
        parts: [prompt],
      },
      metadata: {
        selected_all_github_repos: false,
        selected_github_repos: [],
        serialization_metadata: {
          custom_symbol_offsets: [],
        },
        dictation: false,
      },
    },
    model,
  });
}

export function buildChatGptAuthenticatedConversationPrepareBody(input: {
  parentMessageId: string;
  model: string;
}): Record<string, unknown> {
  return {
    action: "next",
    parent_message_id: input.parentMessageId,
    model: input.model,
    timezone_offset_min: getChatGptWebTimezoneOffsetMinutes(),
    timezone: getLocalTimezoneName(),
    suggestions: [],
    history_and_training_disabled: true,
    conversation_mode: {
      kind: "primary_assistant",
    },
    system_hints: [],
    supports_buffering: true,
    supported_encodings: ["v1"],
    client_contextual_info: buildChatGptClientContextualInfo(),
    paragen_cot_summary_display_override: "allow",
  };
}

export function buildChatGptAuthenticatedTextConversationBody(input: {
  prompt: string;
  model: string;
  parentMessageId: string;
}): Record<string, unknown> {
  return {
    action: "next",
    messages: [
      {
        id: randomUUID(),
        author: {
          role: "user",
        },
        content: {
          content_type: "text",
          parts: [input.prompt],
        },
        metadata: {
          serialization_metadata: {
            custom_symbol_offsets: [],
          },
        },
      },
    ],
    parent_message_id: input.parentMessageId,
    model: input.model,
    timezone_offset_min: getChatGptWebTimezoneOffsetMinutes(),
    timezone: getLocalTimezoneName(),
    suggestions: [],
    history_and_training_disabled: true,
    conversation_mode: {
      kind: "primary_assistant",
    },
    system_hints: [],
    supports_buffering: true,
    supported_encodings: ["v1"],
    client_contextual_info: buildChatGptClientContextualInfo(),
    paragen_cot_summary_display_override: "allow",
  };
}

function buildChatGptImageConversationBody(input: {
  prompt: string;
  model: string;
  image: ChatGptUploadedImage;
}): Record<string, unknown> {
  return buildChatGptConversationBody({
    message: {
      id: randomUUID(),
      author: {
        role: "user",
      },
      create_time: Date.now(),
      content: {
        content_type: "multimodal_text",
        parts: [
          {
            content_type: "image_asset_pointer",
            asset_pointer: `file-service://${input.image.fileId}`,
            size_bytes: input.image.sizeBytes,
            width: input.image.width,
            height: input.image.height,
          },
          input.prompt,
        ],
      },
      metadata: {
        attachments: [
          {
            id: input.image.fileId,
            size: input.image.sizeBytes,
            name: input.image.filename,
            mime_type: input.image.mimeType,
            width: input.image.width,
            height: input.image.height,
            source: "local",
          },
        ],
        selected_all_github_repos: false,
        selected_github_repos: [],
        serialization_metadata: {
          custom_symbol_offsets: [],
        },
        dictation: false,
      },
    },
    model: input.model,
  });
}

function buildChatGptConversationBody(input: {
  message: Record<string, unknown>;
  model: string;
}): Record<string, unknown> {
  return {
    action: "next",
    messages: [input.message],
    paragen_cot_summary_display_override: "allow",
    parent_message_id: "client-created-root",
    model: input.model,
    timezone_offset_min: getLocalTimezoneOffsetMinutes(),
    timezone: getLocalTimezoneName(),
    suggestions: [],
    history_and_training_disabled: true,
    conversation_mode: {
      kind: "primary_assistant",
    },
    system_hints: [],
    supports_buffering: true,
    supported_encodings: ["v1"],
    client_contextual_info: buildChatGptClientContextualInfo(),
  };
}

function buildChatGptClientContextualInfo(): Record<string, unknown> {
  return {
    is_dark_mode: true,
    time_since_loaded: 7,
    page_height: 911,
    page_width: 1080,
    pixel_ratio: 1,
    screen_height: 1080,
    screen_width: 1920,
    app_name: "chatgpt.com",
  };
}

function getChatGptWebTimezoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

function buildChatGptBlobUploadHeaders(mimeType: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": mimeType,
    origin: "https://chatgpt.com",
    referer: "https://chatgpt.com/",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "user-agent": CHATGPT_ANON_BROWSER.agent,
    "x-ms-blob-type": "BlockBlob",
    "x-ms-version": "2020-04-08",
  };
}

function extractCookieValueFromResponse(response: Response, name: string): string | undefined {
  const headersWithSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof headersWithSetCookie.getSetCookie === "function"
      ? headersWithSetCookie.getSetCookie()
      : [response.headers.get("set-cookie")].filter((value): value is string => typeof value === "string");

  const pattern = new RegExp(`(?:^|[;,]\\s*)${name}=([^;]+)`, "u");
  for (const header of setCookies) {
    const match = pattern.exec(header);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

async function ensureChatGptDeviceId(client: SessionHttpClientType): Promise<string> {
  const existing = await client.getCookieValue("oai-did", CHATGPT_HOME_URL);
  if (existing) {
    return existing;
  }

  const next = randomUUID();
  await client.jar.setCookie(`oai-did=${next}; Domain=.chatgpt.com; Path=/; SameSite=Lax`, CHATGPT_HOME_URL);
  return next;
}

export function extractChatGptCloudflareRequestId(html: string): string | undefined {
  const match = html.match(/__CF\$cv\$params=\{r:'([^']+)'/u);
  return match?.[1];
}

export function extractChatGptCloudflareChallengePath(script: string): string | undefined {
  const match = script.match(/\/jsd\/oneshot\/[A-Za-z0-9._-]+\/[A-Za-z0-9._:-]+\/?/u);
  return match?.[0];
}

export function buildChatGptCloudflareOneShotUrl(requestId: string, challengePath: string): string {
  const normalizedPath = challengePath.startsWith("/") ? challengePath : `/${challengePath}`;
  const withTrailingSlash = normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
  return `https://chatgpt.com/cdn-cgi/challenge-platform/h/g${withTrailingSlash}${requestId}`;
}

function toChatGptUser(session: ChatGptAuthSessionResponse): SessionUser | undefined {
  const name = typeof session.user?.name === "string" ? session.user.name : undefined;
  const email = typeof session.user?.email === "string" ? session.user.email : undefined;
  const id = typeof session.user?.id === "string" ? session.user.id : undefined;

  if (!name && !email && !id) {
    return undefined;
  }

  return {
    id,
    username: email,
    displayName: name ?? email,
  };
}

function randomIp(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(".");
}

function randomFloat(min: number, max: number): string {
  return (Math.random() * (max - min) + min).toFixed(4);
}

function getLocalTimezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

function getLocalTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isChatGptExpiredError(error: unknown): boolean {
  return isAutoCliError(error) && error.code === "CHATGPT_SESSION_EXPIRED";
}

function mapChatGptError(error: unknown, fallbackMessage: string): AutoCliError {
  if (isAutoCliError(error)) {
    if (error.code === "HTTP_REQUEST_FAILED") {
      const status = Number(error.details?.status);
      const body = typeof error.details?.body === "string" ? error.details.body : "";

      if (status === 403 && /unusual activity/i.test(body)) {
        return new AutoCliError(
          "CHATGPT_UNUSUAL_ACTIVITY",
          "ChatGPT rejected the browserless web request as unusual activity. Try again later.",
          {
            details: error.details,
          },
        );
      }

      if (status === 429) {
        return new AutoCliError("CHATGPT_RATE_LIMITED", "ChatGPT rate limited the browserless web request.", {
          details: error.details,
        });
      }
    }

    return error;
  }

  if (error instanceof Error) {
    return new AutoCliError("CHATGPT_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details: {
        message: error.message,
      },
    });
  }

  return new AutoCliError("CHATGPT_REQUEST_FAILED", fallbackMessage);
}

import { randomInt, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { ensureDirectory, getCachePath } from "../../../config.js";
import { MikaCliError, isMikaCliError } from "../../../errors.js";
import { readMediaFile } from "../../../utils/media.js";
import { appendUploadFileField } from "../../../utils/upload-pipeline.js";

import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus } from "../../../types.js";

const GEMINI_GOOGLE_URL = "https://www.google.com/";
const GEMINI_APP_URL = "https://gemini.google.com/app";
const GEMINI_GENERATE_URL =
  "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate";
const GEMINI_ROTATE_COOKIES_URL = "https://accounts.google.com/RotateCookies";
const GEMINI_UPLOAD_URL = "https://content-push.googleapis.com/upload";
const GEMINI_DEFAULT_PUSH_ID = "feeds/mcudyrk2a4khkz";

const GEMINI_DEFAULT_METADATA: readonly unknown[] = ["", "", "", null, null, null, null, null, null, ""];
const GEMINI_DEFAULT_MODEL = "gemini-3-flash";
const GEMINI_DEFAULT_MODEL_HEADER = '[1,null,null,null,"fbb127bbb056c959",null,null,0,[4],null,null,1]';
const GEMINI_HEADERS = {
  origin: "https://gemini.google.com",
  referer: "https://gemini.google.com/",
};
const GEMINI_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

const GEMINI_MODEL_HEADERS: Record<string, { name: string; header: string }> = {
  gemini: { name: GEMINI_DEFAULT_MODEL, header: GEMINI_DEFAULT_MODEL_HEADER },
  fast: { name: GEMINI_DEFAULT_MODEL, header: GEMINI_DEFAULT_MODEL_HEADER },
  "gemini-3-flash": { name: "gemini-3-flash", header: '[1,null,null,null,"fbb127bbb056c959",null,null,0,[4],null,null,1]' },
  "gemini-3-thinking": {
    name: "gemini-3-thinking",
    header: '[1,null,null,null,"5bf011840784117a",null,null,0,[4],null,null,1]',
  },
  "gemini-3-pro": {
    name: "gemini-3-pro",
    header: '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4],null,null,1]',
  },
  "gemini-3-flash-advanced": {
    name: "gemini-3-flash-advanced",
    header: '[1,null,null,null,"56fdd199312815e2",null,null,0,[4],null,null,2]',
  },
  "gemini-3-thinking-advanced": {
    name: "gemini-3-thinking-advanced",
    header: '[1,null,null,null,"e051ce1aa80aa576",null,null,0,[4],null,null,2]',
  },
  "gemini-3-pro-advanced": {
    name: "gemini-3-pro-advanced",
    header: '[1,null,null,null,"e6fa609c3fa255c0",null,null,0,[4],null,null,2]',
  },
};

interface GeminiBootstrap {
  accessToken: string;
  buildLabel: string;
  sessionId: string;
  language: string;
  pushId: string;
}

interface GeminiParsedOutput {
  outputText: string;
  chatId?: string;
  responseId?: string;
  candidateId?: string;
  generatedImageUrls: string[];
  generatedVideoUrls: string[];
  generatedVideoThumbnailUrls: string[];
}

export interface GeminiInspectionResult {
  status: SessionStatus;
  defaultModel: string;
}

export interface GeminiTextExecutionResult {
  outputText: string;
  chatId?: string;
  responseId?: string;
  candidateId?: string;
  model: string;
  url?: string;
}

export interface GeminiMediaExecutionResult extends GeminiTextExecutionResult {
  outputUrls?: string[];
  thumbnailUrls?: string[];
}

export interface GeminiMediaDownloadResult {
  outputUrls: string[];
  outputPaths: string[];
}

export class GeminiService {
  async inspectSession(client: SessionHttpClient): Promise<GeminiInspectionResult> {
    try {
      await this.rotateCookies(client).catch(() => {});
      await this.bootstrap(client);

      return {
        status: {
          state: "active",
          message: "Gemini session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        defaultModel: GEMINI_DEFAULT_MODEL,
      };
    } catch (error) {
      if (isGeminiExpiredError(error)) {
        return {
          status: {
            state: "expired",
            message: "Gemini session expired. Re-import cookies.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "SESSION_EXPIRED",
          },
          defaultModel: GEMINI_DEFAULT_MODEL,
        };
      }

      if (isMikaCliError(error)) {
        return {
          status: {
            state: "unknown",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
          defaultModel: GEMINI_DEFAULT_MODEL,
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
  ): Promise<GeminiTextExecutionResult> {
    try {
      const result = await this.executePrompt(client, {
        prompt: input.prompt,
        model: input.model,
      });

      if (!result.outputText) {
        throw new MikaCliError("GEMINI_EMPTY_RESPONSE", "Gemini returned an empty response.", {
          details: {
            model: result.model,
          },
        });
      }

      return {
        ...result,
      };
    } catch (error) {
      throw mapGeminiError(error, "Failed to complete the Gemini prompt.");
    }
  }

  async executeImage(
    client: SessionHttpClient,
    input: {
      mediaPath: string;
      caption?: string;
      model?: string;
    },
  ): Promise<GeminiMediaExecutionResult> {
    try {
      const bootstrap = await this.bootstrap(client);
      const media = await readMediaFile(input.mediaPath);
      const uploadedFile = await this.uploadFile(client, bootstrap.pushId, media);
      const result = await this.executePrompt(client, {
        prompt: input.caption?.trim() || "Describe this image.",
        model: input.model,
        files: [[[uploadedFile], media.filename]],
        bootstrap,
      });

      if (!result.outputText && (!result.outputUrls || result.outputUrls.length === 0)) {
        throw new MikaCliError("GEMINI_EMPTY_RESPONSE", "Gemini returned an empty response for the uploaded image.", {
          details: {
            model: result.model,
          },
        });
      }

      return result;
    } catch (error) {
      throw mapGeminiError(error, "Failed to complete the Gemini image prompt.");
    }
  }

  async executeVideo(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
    },
  ): Promise<GeminiMediaExecutionResult> {
    try {
      const result = await this.executePrompt(client, {
        prompt: input.prompt,
        model: input.model,
      });

      if (!result.outputUrls || result.outputUrls.length === 0) {
        throw new MikaCliError("GEMINI_VIDEO_NOT_RETURNED", "Gemini did not return a video for this prompt.", {
          details: {
            model: result.model,
            outputText: result.outputText || undefined,
          },
        });
      }

      return result;
    } catch (error) {
      throw mapGeminiError(error, "Failed to complete the Gemini video prompt.");
    }
  }

  async downloadMedia(
    client: SessionHttpClient,
    input: {
      kind: "image" | "video";
      outputUrls: string[];
      outputDir?: string;
      chatId?: string;
    },
  ): Promise<GeminiMediaDownloadResult> {
    try {
      const outputUrls = dedupeGeminiValues(input.outputUrls);
      if (outputUrls.length === 0) {
        throw new MikaCliError(
          "GEMINI_MEDIA_DOWNLOAD_UNAVAILABLE",
          `Gemini did not provide any downloadable ${input.kind} URLs for this job.`,
          {
            details: {
              kind: input.kind,
              chatId: input.chatId,
            },
          },
        );
      }

      const outputDir = input.outputDir ?? getCachePath("gemini", "generated", input.kind === "image" ? "images" : "videos");
      await ensureDirectory(outputDir);

      const outputPaths: string[] = [];
      for (const [index, outputUrl] of outputUrls.entries()) {
        const response = await client.requestWithResponse<ArrayBuffer>(outputUrl, {
          responseType: "arrayBuffer",
          expectedStatus: 200,
          headers: {
            referer: input.chatId ? `https://gemini.google.com/app/${input.chatId}` : GEMINI_APP_URL,
            "user-agent": GEMINI_USER_AGENT,
          },
        });

        const extension = normalizeGeminiDownloadExtension(
          outputUrl,
          response.response.headers.get("content-type") ?? undefined,
          input.kind,
        );
        const filename = buildGeminiDownloadFilename({
          chatId: input.chatId,
          kind: input.kind,
          index,
          extension,
        });
        const outputPath = join(outputDir, filename);
        await writeFile(outputPath, Buffer.from(response.data));
        outputPaths.push(outputPath);
      }

      return {
        outputUrls,
        outputPaths,
      };
    } catch (error) {
      throw mapGeminiError(error, `Failed to download the Gemini ${input.kind}.`);
    }
  }

  private async executePrompt(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
      files?: unknown[];
      bootstrap?: GeminiBootstrap;
    },
  ): Promise<GeminiMediaExecutionResult> {
    const bootstrap = input.bootstrap ?? (await this.bootstrap(client));
    const model = resolveGeminiModel(input.model);
    const requestId = randomUUID().toUpperCase();
    const payload = buildGeminiPromptPayload({
      prompt: input.prompt,
      language: bootstrap.language,
      requestId,
      files: input.files,
    });

    const response = await client.request<string>(`${GEMINI_GENERATE_URL}?${buildGeminiGenerateParams(bootstrap)}`, {
      method: "POST",
      headers: {
        ...GEMINI_HEADERS,
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-same-domain": "1",
        "x-goog-ext-525001261-jspb": model.header,
        "x-goog-ext-73010989-jspb": "[0]",
        "x-goog-ext-73010990-jspb": "[0]",
        "x-goog-ext-525005358-jspb": `["${requestId}",1]`,
        "user-agent": GEMINI_USER_AGENT,
      },
      body: new URLSearchParams({
        at: bootstrap.accessToken,
        "f.req": JSON.stringify([null, JSON.stringify(payload)]),
      }).toString(),
      responseType: "text",
      expectedStatus: 200,
    });

    const parsed = parseGeminiGenerateResponse(response);
    return {
      outputText: parsed.outputText,
      chatId: parsed.chatId,
      responseId: parsed.responseId,
      candidateId: parsed.candidateId,
      model: model.name,
      url: parsed.chatId ? `https://gemini.google.com/app/${parsed.chatId}` : undefined,
      outputUrls:
        parsed.generatedVideoUrls.length > 0 ? parsed.generatedVideoUrls : parsed.generatedImageUrls,
      thumbnailUrls: parsed.generatedVideoThumbnailUrls,
    };
  }

  private async uploadFile(
    client: SessionHttpClient,
    pushId: string,
    file: Awaited<ReturnType<typeof readMediaFile>>,
  ): Promise<string> {
    const form = new FormData();
    appendUploadFileField(form, "file", file);

    const response = await client.request<string>(GEMINI_UPLOAD_URL, {
      method: "POST",
      headers: {
        origin: "https://gemini.google.com",
        referer: "https://gemini.google.com/",
        "x-tenant-id": "bard-storage",
        "push-id": pushId,
        "user-agent": GEMINI_USER_AGENT,
      },
      body: form,
      responseType: "text",
      expectedStatus: 200,
    });

    const uploadedFile = response.trim();
    if (!uploadedFile) {
      throw new MikaCliError("GEMINI_FILE_UPLOAD_FAILED", "Gemini did not return an uploaded file reference.");
    }

    return uploadedFile;
  }

  private async bootstrap(client: SessionHttpClient): Promise<GeminiBootstrap> {
    await client.request<string>(GEMINI_GOOGLE_URL, {
      responseType: "text",
      expectedStatus: 200,
    });

    const { data: html, response } = await client.requestWithResponse<string>(GEMINI_APP_URL, {
      headers: GEMINI_HEADERS,
      responseType: "text",
      expectedStatus: 200,
    });

    if (!response.url.startsWith("https://gemini.google.com/")) {
      throw new MikaCliError("GEMINI_SESSION_EXPIRED", "Gemini redirected away from the app. Re-import cookies.", {
        details: {
          redirectedUrl: response.url,
        },
      });
    }

    const bootstrap = extractGeminiBootstrap(html);
    if (!bootstrap.accessToken || !bootstrap.buildLabel || !bootstrap.sessionId) {
      const message =
        bootstrap.buildLabel || bootstrap.sessionId
          ? "Gemini loaded, but the exported cookies did not expose a live request token. Re-export cookies from a currently working Gemini tab."
          : "Gemini redirected away from the authenticated app bootstrap. Re-import cookies.";
      throw new MikaCliError("GEMINI_SESSION_EXPIRED", message, {
        details: {
          hasAccessToken: Boolean(bootstrap.accessToken),
          hasBuildLabel: Boolean(bootstrap.buildLabel),
          hasSessionId: Boolean(bootstrap.sessionId),
        },
      });
    }

    return bootstrap;
  }

  private async rotateCookies(client: SessionHttpClient): Promise<void> {
    await client.request<string>(GEMINI_ROTATE_COOKIES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://accounts.google.com",
      },
      body: '[000,"-0000000000000000000"]',
      responseType: "text",
      expectedStatus: [200, 401],
    });
  }
}

function buildGeminiGenerateParams(bootstrap: GeminiBootstrap): string {
  return new URLSearchParams({
    bl: bootstrap.buildLabel,
    "f.sid": bootstrap.sessionId,
    hl: bootstrap.language,
    _reqid: String(randomInt(10000, 99999)),
    rt: "c",
  }).toString();
}

function buildGeminiPromptPayload(input: {
  prompt: string;
  language: string;
  requestId: string;
  files?: unknown[];
}): unknown[] {
  const inner = Array(69).fill(null);
  inner[0] = [input.prompt, 0, null, input.files ?? null, null, null, 0];
  inner[1] = [input.language];
  inner[2] = [...GEMINI_DEFAULT_METADATA];
  inner[6] = [1];
  inner[7] = 1;
  inner[10] = 1;
  inner[11] = 0;
  inner[17] = [[0]];
  inner[18] = 0;
  inner[27] = 1;
  inner[30] = [4];
  inner[41] = [1];
  inner[53] = 0;
  inner[59] = input.requestId;
  inner[61] = [];
  inner[68] = 2;
  return inner;
}

function resolveGeminiModel(name?: string): { name: string; header: string } {
  if (!name) {
    return GEMINI_MODEL_HEADERS.gemini!;
  }

  const key = name.trim().toLowerCase();
  const resolved = GEMINI_MODEL_HEADERS[key];
  if (!resolved) {
    throw new MikaCliError(
      "GEMINI_MODEL_UNSUPPORTED",
      `Unsupported Gemini model "${name}".`,
      {
        details: {
          supportedModels: Object.keys(GEMINI_MODEL_HEADERS).sort(),
        },
      },
    );
  }

  return resolved;
}

export function extractGeminiBootstrap(html: string): GeminiBootstrap {
  return {
    accessToken: extractGeminiString(html, "SNlM0e") ?? "",
    buildLabel: extractGeminiString(html, "cfb2h") ?? "",
    sessionId: extractGeminiString(html, "FdrFJe") ?? "",
    language: extractGeminiString(html, "TuX5cc") ?? "en-US",
    pushId: extractGeminiString(html, "qKIAYe") ?? GEMINI_DEFAULT_PUSH_ID,
  };
}

function extractGeminiString(html: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`"${escapedKey}":"((?:[^"\\\\]|\\\\.)*)"`, "u"));
  if (!match) {
    return undefined;
  }

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

export function parseGeminiGenerateResponse(text: string): GeminiParsedOutput {
  const frames = parseGeminiResponseFrames(text);
  let outputText = "";
  let chatId: string | undefined;
  let responseId: string | undefined;
  let candidateId: string | undefined;
  let generatedImageUrls: string[] = [];
  let generatedVideoUrls: string[] = [];
  let generatedVideoThumbnailUrls: string[] = [];

  for (const frame of frames) {
    const bodyString = getNestedValue(frame, [2]);
    if (typeof bodyString !== "string") {
      continue;
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyString);
    } catch {
      continue;
    }

    const ids = getNestedValue(body, [1]);
    if (Array.isArray(ids)) {
      chatId = typeof ids[0] === "string" ? ids[0] : chatId;
      responseId = typeof ids[1] === "string" ? ids[1] : responseId;
    }

    const candidates = getNestedValue(body, [4]);
    if (!Array.isArray(candidates)) {
      continue;
    }

    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }

      candidateId = typeof candidate[0] === "string" ? candidate[0] : candidateId;
      const textParts = candidate[1];
      if (Array.isArray(textParts)) {
        const nextText = textParts.filter((part): part is string => typeof part === "string").join("\n").trim();
        if (nextText) {
          outputText = nextText;
        }
      }

      generatedImageUrls = parseGeminiGeneratedImageUrls(candidate);
      const generatedVideos = parseGeminiGeneratedVideoUrls(candidate);
      generatedVideoUrls = generatedVideos.videoUrls;
      generatedVideoThumbnailUrls = generatedVideos.thumbnailUrls;
    }
  }

  return {
    outputText,
    chatId,
    responseId,
    candidateId,
    generatedImageUrls,
    generatedVideoUrls,
    generatedVideoThumbnailUrls,
  };
}

export function parseGeminiResponseFrames(text: string): unknown[] {
  const content = text.startsWith(")]}'") ? text.slice(4) : text;
  const frames: unknown[] = [];

  const lines = content.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const lengthValue = lines[index]?.trim() ?? "";
    if (!/^\d+$/u.test(lengthValue)) {
      continue;
    }

    const chunk = lines[index + 1]?.trim();
    if (!chunk) {
      continue;
    }

    index += 1;

    try {
      const parsed = JSON.parse(chunk);
      if (Array.isArray(parsed)) {
        frames.push(...parsed);
      } else {
        frames.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return frames;
}

function getNestedValue(value: unknown, path: number[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function parseGeminiGeneratedImageUrls(candidate: unknown[]): string[] {
  const imageBlocks = getNestedValue(candidate, [12, 7, 0]);
  if (!Array.isArray(imageBlocks)) {
    return [];
  }

  const urls: string[] = [];
  for (const block of imageBlocks) {
    const url = getNestedValue(block, [0, 3, 3]);
    if (typeof url === "string" && url.length > 0) {
      urls.push(url);
    }
  }

  return urls;
}

function parseGeminiGeneratedVideoUrls(candidate: unknown[]): {
  videoUrls: string[];
  thumbnailUrls: string[];
} {
  const urls = getNestedValue(candidate, [12, 59, 0, 0, 0, 0, 7]);
  if (!Array.isArray(urls)) {
    return {
      videoUrls: [],
      thumbnailUrls: [],
    };
  }

  const thumbnailUrls = urls.filter((value, index): value is string => index % 2 === 0 && typeof value === "string" && value.length > 0);
  const videoUrls = urls.filter((value, index): value is string => index % 2 === 1 && typeof value === "string" && value.length > 0);

  return {
    videoUrls,
    thumbnailUrls,
  };
}

function buildGeminiDownloadFilename(input: {
  chatId?: string;
  kind: "image" | "video";
  index: number;
  extension: string;
}): string {
  const identity = sanitizeGeminiFilename(input.chatId ?? "gemini");
  return `${identity}-${input.kind}-${input.index + 1}-${randomUUID()}.${input.extension}`;
}

function normalizeGeminiDownloadExtension(
  outputUrl: string,
  contentType: string | undefined,
  kind: "image" | "video",
): string {
  const pathnameExtension = extname(safeGeminiUrlPathname(outputUrl)).replace(/^\./u, "").toLowerCase();
  if (pathnameExtension) {
    return pathnameExtension;
  }

  const normalizedContentType = contentType?.split(";")[0]?.trim().toLowerCase();
  switch (normalizedContentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return kind === "image" ? "png" : "mp4";
  }
}

function safeGeminiUrlPathname(outputUrl: string): string {
  try {
    return new URL(outputUrl).pathname;
  } catch {
    return outputUrl;
  }
}

function sanitizeGeminiFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/-+/gu, "-").replace(/^-|-$/gu, "") || "gemini";
}

function dedupeGeminiValues(values: readonly string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function isGeminiExpiredError(error: unknown): boolean {
  return isMikaCliError(error) && ["GEMINI_SESSION_EXPIRED", "HTTP_REQUEST_FAILED"].includes(error.code);
}

function mapGeminiError(error: unknown, fallbackMessage: string): MikaCliError {
  if (isMikaCliError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new MikaCliError("GEMINI_REQUEST_FAILED", error.message || fallbackMessage, {
      cause: error,
    });
  }

  return new MikaCliError("GEMINI_REQUEST_FAILED", fallbackMessage);
}

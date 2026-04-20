import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Cookie, CookieJar } from "tough-cookie";
import { ModuleClient, SessionClient } from "tlsclientwrapper";

import { ensureParentDirectory, getCachePath } from "../../../config.js";
import { MikaCliError, isMikaCliError } from "../../../errors.js";
import { runFirstClassBrowserAction } from "../../../core/runtime/browser-action-runtime.js";
import { normalizeWhitespace } from "../../data/shared/text.js";

import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus, SessionUser } from "../../../types.js";
import type { Page as PlaywrightPage } from "playwright-core";

const GROK_HOME_URL = "https://grok.com/";
const GROK_IMAGINE_URL = "https://grok.com/imagine";
const GROK_CREATE_CONVERSATION_URL = "https://grok.com/rest/app-chat/conversations/new";
const GROK_MEDIA_POST_URL = "https://grok.com/rest/media/post/get";
const GROK_DEFAULT_MODEL = "grok-3";
const GROK_ASSET_BASE_URL = "https://assets.grok.com/";
const GROK_VIDEO_POLL_TIMEOUT_MS = 90_000;
const GROK_VIDEO_POLL_INTERVAL_MS = 3_000;
const GROK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const GROK_ACCEPT_LANGUAGE = "en-US,en;q=0.9";
const GROK_TLS_CLIENT_IDENTIFIER = "chrome_146";
const GROK_CREATE_STATSIG_IDS = [
  "d+QJ/pTCbTLFjicYQpdy3LuCpY4dNMm2vOB94F21e7fKEIGnvaC60d/v8N+z8uLj4obNAnIN3hObDZJtfNWdlPS423btdA",
  "wDhAC5tgENpWVsYXN0kQnXXQ+Xtq38rZRVppk9Uy1xhmWpIdU7q6y4f6HEU3wXpLl9N0tcWvwAioklw42J27RNEuP5ssww",
] as const;
const GROK_TLS_DEFAULT_HEADERS = {
  "accept-language": GROK_ACCEPT_LANGUAGE,
  "user-agent": GROK_USER_AGENT,
  "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"macOS\"",
} as const;
const GROK_HOME_REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "cache-control": "max-age=0",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
} as const;
const GROK_CREATE_HEADER_ORDER = [
  "x-xai-request-id",
  "sec-ch-ua-platform",
  "referer",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "baggage",
  "sentry-trace",
  "traceparent",
  "user-agent",
  "content-type",
  "x-statsig-id",
  "accept",
  "accept-language",
  "origin",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
] as const;

interface GrokErrorEnvelope {
  error?: {
    code?: number | string;
    message?: string;
    details?: unknown[];
  };
}

interface GrokConversationRecord {
  conversationId?: string;
}

interface GrokResponseRecord {
  responseId?: string;
  message?: string;
  sender?: string;
  model?: string;
}

interface GrokFollowUpSuggestionsRecord {
  suggestions?: Array<{
    suggestion?: string;
  }>;
}

interface GrokFinalMetadataRecord {
  followUpSuggestions?: GrokFollowUpSuggestionsRecord;
}

interface GrokCardAttachmentRecord {
  jsonData?: string;
}

interface GrokStreamingVideoGenerationRecord {
  videoId?: string;
  videoUrl?: string;
  progress?: number;
  modelName?: string;
  resolutionName?: string;
  mode?: string;
  parentPostId?: string;
  videoPostId?: string;
}

interface GrokStreamingResponseRecord {
  userResponse?: GrokResponseRecord;
  modelResponse?: GrokResponseRecord;
  token?: string;
  messageTag?: string;
  finalMetadata?: GrokFinalMetadataRecord;
  cardAttachment?: GrokCardAttachmentRecord;
  streamingVideoGenerationResponse?: GrokStreamingVideoGenerationRecord;
}

interface GrokCreateResultRecord {
  response?: GrokStreamingResponseRecord;
  conversation?: GrokConversationRecord;
}

interface GrokChunkRecord {
  result?: GrokCreateResultRecord | GrokStreamingResponseRecord;
  error?: GrokErrorEnvelope["error"];
}

interface GrokHomeInspection {
  isAuthenticated: boolean;
  subscriptionTier?: string;
  userId?: string;
}

interface GrokGeneratedImageCardRecord {
  id?: string;
  type?: string;
  cardType?: string;
  image_chunk?: {
    imageUuid?: string;
    imageUrl?: string;
    progress?: number;
  };
}

interface ParsedGrokGeneratedImageAsset {
  imageUuid?: string;
  assetPath: string;
  progress?: number;
  cardId?: string;
}

interface ParsedGrokVideoUpdate {
  videoId?: string;
  videoUrl?: string;
  progress?: number;
  modelName?: string;
  resolutionName?: string;
  mode?: string;
  parentPostId?: string;
  videoPostId?: string;
}

export interface GrokInspectionResult {
  status: SessionStatus;
  user?: SessionUser;
  defaultModel: string;
  subscriptionTier?: string;
}

export interface GrokTextExecutionResult {
  outputText: string;
  conversationId?: string;
  responseId?: string;
  model: string;
  followUpSuggestions: string[];
}

export interface GrokImageExecutionResult extends GrokTextExecutionResult {
  outputUrls: string[];
  outputPaths: string[];
  imageUuid?: string;
}

export interface GrokImageDownloadResult {
  outputUrls: string[];
  outputPaths: string[];
}

export interface GrokVideoExecutionResult extends GrokTextExecutionResult {
  status: "completed" | "processing";
  outputUrl?: string;
  outputUrls: string[];
  outputPaths: string[];
  videoId?: string;
  progress?: number;
  seedImageUrl?: string;
  seedImagePath?: string;
}

export interface GrokVideoStatusResult extends GrokTextExecutionResult {
  status: "processing" | "completed" | "canceled" | "failed" | "unknown";
  message: string;
  outputUrl?: string;
  outputUrls: string[];
  outputPaths: string[];
  videoId?: string;
  progress?: number;
  inflightResponseIds: string[];
}

interface ParsedGrokConversationStream {
  outputText: string;
  conversationId?: string;
  responseId?: string;
  model?: string;
  followUpSuggestions: string[];
  imageAssets: ParsedGrokGeneratedImageAsset[];
  videoUpdates: ParsedGrokVideoUpdate[];
}

export class GrokService {
  async inspectSession(client: SessionHttpClient): Promise<GrokInspectionResult> {
    try {
      const html = await this.fetchHomeHtml(client);
      const inspection = inspectGrokHomeHtml(html);
      if (!inspection.isAuthenticated) {
        return {
          status: {
            state: "expired",
            message: "Grok did not expose an authenticated web session. Re-import cookies from a logged-in Grok tab.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "SESSION_EXPIRED",
          },
          defaultModel: GROK_DEFAULT_MODEL,
        };
      }

      return {
        status: {
          state: "active",
          message: "Grok session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: inspection.userId
          ? {
              id: inspection.userId,
            }
          : undefined,
        defaultModel: GROK_DEFAULT_MODEL,
        subscriptionTier: inspection.subscriptionTier,
      };
    } catch (error) {
      if (isMikaCliError(error)) {
        return {
          status: {
            state: "unknown",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
          defaultModel: GROK_DEFAULT_MODEL,
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
      browser?: boolean;
      browserTimeoutSeconds?: number;
    },
  ): Promise<GrokTextExecutionResult> {
    if (input.browser) {
      return this.executeTextInBrowser(client, input);
    }

    try {
      const parsed = await withGrokTlsSession(client.jar, async (session) =>
        parseGrokConversationStream(
          await postGrokCreateConversation(session, client.jar, buildGrokCreatePayload(input.prompt, input.model)),
        ),
      );

      if (!parsed.outputText) {
        throw new MikaCliError("GROK_EMPTY_RESPONSE", "Grok returned an empty response.", {
          details: {
            conversationId: parsed.conversationId,
            responseId: parsed.responseId,
            model: parsed.model ?? resolveGrokModel(input.model),
          },
        });
      }

      return {
        outputText: parsed.outputText,
        conversationId: parsed.conversationId,
        responseId: parsed.responseId,
        model: parsed.model ?? resolveGrokModel(input.model),
        followUpSuggestions: parsed.followUpSuggestions,
      };
    } catch (error) {
      const mapped = mapGrokError(error, "Failed to complete the Grok prompt.");
      if (mapped.code === "GROK_ANTI_BOT_BLOCKED") {
        return this.executeTextInBrowser(client, input);
      }
      throw mapped;
    }
  }

  async executeImage(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
      browser?: boolean;
      browserTimeoutSeconds?: number;
    },
  ): Promise<GrokImageExecutionResult> {
    return this.executeImageInBrowser(client, input);

  }

  async downloadImages(
    client: SessionHttpClient,
    input: {
      outputUrls: string[];
      conversationId?: string;
      outputDir?: string;
    },
  ): Promise<GrokImageDownloadResult> {
    try {
      return await withGrokTlsSession(client.jar, async (session) => {
        const outputUrls = dedupeValues(input.outputUrls);
        if (outputUrls.length === 0) {
          throw new MikaCliError(
            "GROK_IMAGE_DOWNLOAD_UNAVAILABLE",
            "Grok did not provide any downloadable image asset URLs for this job.",
            {
              details: {
                conversationId: input.conversationId,
              },
            },
          );
        }
        const outputPaths = await Promise.all(
          outputUrls.map((outputUrl, index) =>
            downloadGrokAsset(session, client.jar, outputUrl, "images", {
              prefix: `${input.conversationId ?? "grok-image"}-${index + 1}`,
              outputDir: input.outputDir,
            }),
          ),
        );

        return {
          outputUrls,
          outputPaths,
        };
      });
    } catch (error) {
      throw mapGrokError(error, "Failed to download the Grok image.");
    }
  }

  async executeVideo(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
      browser?: boolean;
      browserTimeoutSeconds?: number;
    },
  ): Promise<GrokVideoExecutionResult> {
    return this.executeVideoInBrowser(client, input);
  }

  async getVideoStatus(
    client: SessionHttpClient,
    input: {
      conversationId?: string;
      videoId?: string;
      responseId?: string;
      model?: string;
      progress?: number;
      outputText?: string;
      outputUrl?: string;
    },
  ): Promise<GrokVideoStatusResult> {
    try {
      return await withGrokTlsSession(client.jar, async (session) =>
        inspectGrokVideoJob(session, client.jar, {
          ...input,
          model: input.model ?? "imagine-video-gen",
        }),
      );
    } catch (error) {
      throw mapGrokError(error, "Failed to load the Grok video job status.");
    }
  }

  async waitForVideo(
    client: SessionHttpClient,
    input: {
      conversationId?: string;
      videoId?: string;
      responseId?: string;
      model?: string;
      progress?: number;
      outputText?: string;
      outputUrl?: string;
      timeoutMs?: number;
      intervalMs?: number;
    },
  ): Promise<GrokVideoStatusResult> {
    try {
      return await withGrokTlsSession(client.jar, async (session) => {
        const deadline = Date.now() + (input.timeoutMs ?? GROK_VIDEO_POLL_TIMEOUT_MS);
        const intervalMs = input.intervalMs ?? GROK_VIDEO_POLL_INTERVAL_MS;
        let current = await inspectGrokVideoJob(session, client.jar, {
          ...input,
          model: input.model ?? "imagine-video-gen",
        });

        while (Date.now() < deadline && current.status === "processing" && !current.outputUrl) {
          await delay(intervalMs);
          current = await inspectGrokVideoJob(session, client.jar, {
            ...input,
            conversationId: current.conversationId ?? input.conversationId,
            videoId: current.videoId ?? input.videoId,
            responseId: current.responseId ?? input.responseId,
            model: current.model || input.model || "imagine-video-gen",
            progress: current.progress ?? input.progress,
            outputText: current.outputText || input.outputText,
            outputUrl: current.outputUrl ?? input.outputUrl,
          });
        }

        return current;
      });
    } catch (error) {
      throw mapGrokError(error, "Failed while waiting for the Grok video job.");
    }
  }

  async downloadVideo(
    client: SessionHttpClient,
    input: {
      conversationId?: string;
      videoId?: string;
      responseId?: string;
      model?: string;
      progress?: number;
      outputText?: string;
      outputUrl?: string;
      outputDir?: string;
    },
  ): Promise<GrokVideoStatusResult> {
    try {
      return await withGrokTlsSession(client.jar, async (session) => {
        const status = await inspectGrokVideoJob(session, client.jar, {
          ...input,
          model: input.model ?? "imagine-video-gen",
        });

        if (!status.outputUrl) {
          throw new MikaCliError(
            "GROK_VIDEO_NOT_READY",
            "Grok has not exposed the final video asset URL yet. Run `grok video-wait` or `grok video-status` again later.",
            {
              details: {
                conversationId: status.conversationId ?? input.conversationId,
                videoId: status.videoId ?? input.videoId,
                progress: status.progress,
              },
            },
          );
        }

        const outputPath = await downloadGrokAsset(session, client.jar, status.outputUrl, "videos", {
          prefix: `${status.conversationId ?? input.conversationId ?? "grok"}-${status.videoId ?? input.videoId ?? "video"}`,
          outputDir: input.outputDir,
        });

        return {
          ...status,
          status: "completed",
          message: `Downloaded the Grok video to ${outputPath}.`,
          outputPaths: dedupeValues([outputPath, ...status.outputPaths]),
          outputUrls: dedupeValues([status.outputUrl, ...status.outputUrls]),
        };
      });
    } catch (error) {
      throw mapGrokError(error, "Failed to download the Grok video.");
    }
  }

  async cancelVideo(
    client: SessionHttpClient,
    input: {
      conversationId?: string;
      videoId?: string;
      responseId?: string;
      model?: string;
      progress?: number;
      outputText?: string;
      outputUrl?: string;
    },
  ): Promise<GrokVideoStatusResult> {
    try {
      return await withGrokTlsSession(client.jar, async (session) => {
        const current = await inspectGrokVideoJob(session, client.jar, {
          ...input,
          model: input.model ?? "imagine-video-gen",
        });

        if (current.outputUrl) {
          return {
            ...current,
            status: "completed",
            message: "The Grok video job already completed, so there is nothing to cancel.",
          };
        }

        if (!current.conversationId && !input.conversationId) {
          return {
            ...current,
            status: "unknown",
            message: "A conversation ID is required to request cancellation for this Grok video job.",
          };
        }

        if (current.inflightResponseIds.length === 0) {
          return {
            ...current,
            message:
              "Grok no longer reports this video job as inflight. The exposed stop endpoints cannot confirm background cancellation after the render has been accepted.",
          };
        }

        const conversationId = current.conversationId ?? input.conversationId!;
        await stopGrokConversationInflightResponses(session, client.jar, conversationId);
        await Promise.all(
          current.inflightResponseIds.map(async (responseId) => {
            await stopGrokInflightResponse(session, client.jar, responseId).catch(() => {});
          }),
        );

        const after = await inspectGrokVideoJob(session, client.jar, {
          ...input,
          conversationId,
          videoId: current.videoId ?? input.videoId,
          responseId: current.responseId ?? input.responseId,
          model: current.model,
          progress: current.progress,
          outputText: current.outputText,
        });

        if (after.outputUrl) {
          return {
            ...after,
            status: "completed",
            message: "The Grok video completed before cancellation took effect.",
          };
        }

        return {
          ...after,
          status: "canceled",
          message: "Requested cancellation for the current Grok inflight video job.",
          inflightResponseIds: [],
        };
      });
    } catch (error) {
      throw mapGrokError(error, "Failed to cancel the Grok video job.");
    }
  }

  private async fetchHomeHtml(client: SessionHttpClient): Promise<string> {
    const response = await client.requestWithResponse<string>(GROK_HOME_URL, {
      responseType: "text",
      expectedStatus: [200, 403],
      headers: buildGrokHeaders({
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      }),
    });

    if (response.response.status === 403) {
      throw createGrokRequestError(response.response.status, response.data);
    }

    return response.data;
  }

  private async executeTextInBrowser(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
      browser?: boolean;
      browserTimeoutSeconds?: number;
    },
  ): Promise<GrokTextExecutionResult> {
    const parsed = await this.executeConversationInBrowser(client, {
      prompt: input.prompt,
      timeoutSeconds: input.browserTimeoutSeconds,
    });

    if (!parsed.outputText) {
      throw new MikaCliError("GROK_EMPTY_RESPONSE", "Grok returned an empty response.", {
        details: {
          conversationId: parsed.conversationId,
          responseId: parsed.responseId,
          model: parsed.model ?? resolveGrokModel(input.model),
        },
      });
    }

    return {
      outputText: parsed.outputText,
      conversationId: parsed.conversationId,
      responseId: parsed.responseId,
      model: parsed.model ?? resolveGrokModel(input.model),
      followUpSuggestions: parsed.followUpSuggestions,
    };
  }

  private async executeImageInBrowser(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
      browser?: boolean;
      browserTimeoutSeconds?: number;
    },
  ): Promise<GrokImageExecutionResult> {
    const generated = await this.executeImagineInBrowser(client, {
      prompt: input.prompt,
      mode: "image",
      timeoutSeconds: input.browserTimeoutSeconds,
    });
    const outputUrls = resolveBrowserImagineImageUrls(generated);
    if (outputUrls.length === 0) {
      throw new MikaCliError("GROK_IMAGE_GENERATION_FAILED", "Grok did not return any generated images.", {
        details: {
          outputText: generated.parsed?.outputText,
          prompt: input.prompt,
        },
      });
    }

    const downloads = await Promise.all(
      outputUrls.map(async (assetUrl, index) => {
        const outputPath = isDataUri(assetUrl)
          ? await writeGrokBrowserAsset(assetUrl, "images", {
              prefix: `${generated.parsed?.conversationId ?? "grok-image"}-${String(index + 1)}`,
            })
          : await downloadBrowserAccessibleAsset(client, assetUrl, "images", {
              prefix: `${generated.parsed?.conversationId ?? "grok-image"}-${String(index + 1)}`,
              referer: GROK_IMAGINE_URL,
            });
        return {
          outputPath,
          outputUrl: assetUrl,
        };
      }),
    );
    const exposedOutputUrls = downloads
      .map((download) => download.outputUrl)
      .filter((outputUrl) => !isDataUri(outputUrl));

    return {
      outputText:
        generated.parsed?.outputText && !generated.parsed.outputText.includes("<grok:render")
          ? generated.parsed.outputText
          : `Generated ${downloads.length} Grok image${downloads.length === 1 ? "" : "s"}.`,
      conversationId: generated.conversationId ?? generated.parsed?.conversationId,
      responseId: generated.parsed?.responseId,
      model: generated.parsed?.model ?? resolveGrokModel(input.model),
      followUpSuggestions: generated.parsed?.followUpSuggestions ?? [],
      outputPaths: downloads.map((download) => download.outputPath),
      outputUrls: exposedOutputUrls,
      imageUuid: generated.parsed?.imageAssets[0]?.imageUuid,
    };
  }

  private async executeVideoInBrowser(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
      browser?: boolean;
      browserTimeoutSeconds?: number;
    },
  ): Promise<GrokVideoExecutionResult> {
    const generated = await this.executeImagineInBrowser(client, {
      prompt: input.prompt,
      mode: "video",
      timeoutSeconds: input.browserTimeoutSeconds ? Math.max(input.browserTimeoutSeconds, 180) : 180,
    });

    const latestVideoUpdate = selectLatestGrokVideoUpdate(generated.parsed?.videoUpdates ?? []);
    const outputUrl = resolveBrowserImagineVideoUrl(generated, latestVideoUpdate);
    const outputPaths = outputUrl
      ? [
          await downloadBrowserAccessibleAsset(client, outputUrl, "videos", {
            prefix: `${generated.parsed?.conversationId ?? "grok-video"}-video`,
            referer: GROK_IMAGINE_URL,
          }),
        ]
      : [];
    const status: GrokVideoExecutionResult["status"] = outputUrl ? "completed" : "processing";

    return {
      outputText:
        status === "completed"
          ? "Generated a Grok video."
          : "Grok accepted the video generation job, but the final asset URL is still pending.",
      conversationId: generated.conversationId ?? generated.parsed?.conversationId,
      responseId: generated.parsed?.responseId,
      model: generated.parsed?.model ?? latestVideoUpdate?.modelName ?? resolveGrokModel(input.model),
      followUpSuggestions: generated.parsed?.followUpSuggestions ?? [],
      status,
      outputUrl,
      outputUrls: outputUrl ? [outputUrl] : [],
      outputPaths,
      videoId: latestVideoUpdate?.videoId,
      progress: latestVideoUpdate?.progress,
    };
  }

  private async executeConversationInBrowser(
    client: SessionHttpClient,
    input: {
      prompt: string;
      timeoutSeconds?: number;
    },
  ): Promise<ParsedGrokConversationStream> {
    const initialCookies = (await client.jar.getCookies(GROK_HOME_URL)).map((cookie) => cookie.toJSON());
    const execution = await runFirstClassBrowserAction<{
      stream: string;
      cookies: unknown[];
    }>({
      platform: "grok",
      action: "text",
      actionLabel: "text prompt",
      targetUrl: GROK_HOME_URL,
      timeoutSeconds: input.timeoutSeconds ?? 180,
      initialCookies,
      headless: true,
      userAgent: GROK_USER_AGENT,
      locale: "en-US",
      mode: "fallback",
      steps: [
        {
          source: "headless",
          shouldContinueOnError: (error) => shouldRetryGrokBrowserAction(error),
        },
        {
          source: "shared",
          announceLabel: `Opening shared MikaCLI browser profile for Grok: ${GROK_HOME_URL}`,
        },
      ],
      actionFn: async (page) => {
        await this.ensureBrowserAuthenticated(page);
        const stream = await this.submitChatPromptInBrowser(page, input.prompt, input.timeoutSeconds);
        return {
          stream,
          cookies: await page.context().cookies(),
        };
      },
    });
    const result = execution.value;

    await syncBrowserCookiesToJar(client.jar, result.cookies);
    return parseGrokConversationStream(result.stream);
  }

  private async executeImagineInBrowser(
    client: SessionHttpClient,
    input: {
      prompt: string;
      mode: "image" | "video";
      timeoutSeconds?: number;
    },
  ): Promise<{
    assetUrls: string[];
    conversationId?: string;
    parsed?: ParsedGrokConversationStream;
  }> {
    const initialCookies = (await client.jar.getCookies(GROK_HOME_URL)).map((cookie) => cookie.toJSON());
    const execution = await runFirstClassBrowserAction<{
      assetUrls: string[];
      collectedAssetUrls: string[];
      pageUrl: string;
      stream?: string;
      cookies: unknown[];
    }>({
      platform: "grok",
      action: input.mode,
      actionLabel: `${input.mode} generation`,
      targetUrl: GROK_IMAGINE_URL,
      timeoutSeconds: input.timeoutSeconds ?? (input.mode === "video" ? 180 : 120),
      initialCookies,
      headless: true,
      userAgent: GROK_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: [
        {
          source: "headless",
          shouldContinueOnError: (error) => shouldRetryGrokBrowserAction(error),
        },
        {
          source: "shared",
          announceLabel: `Opening shared MikaCLI browser profile for Grok Imagine: ${GROK_IMAGINE_URL}`,
        },
      ],
      actionFn: async (page) => {
        await this.ensureBrowserAuthenticated(page);
        const assetCollector = createGrokGeneratedAssetCollector(page, input.mode);
        const streamPromise = this.captureBrowserConversationStream(
          page,
          Math.min((input.timeoutSeconds ?? (input.mode === "video" ? 180 : 120)) * 1000, 150_000),
        ).catch(() => undefined);
        try {
          const assetUrls = await this.submitImaginePromptInBrowser(page, input.prompt, input.mode, input.timeoutSeconds);
          return {
            assetUrls,
            collectedAssetUrls: assetCollector.stop(),
            pageUrl: page.url(),
            stream: await waitForOptionalBrowserStream(
              streamPromise,
              input.timeoutSeconds ? input.timeoutSeconds * 1000 : (input.mode === "video" ? 12_000 : 6_000),
            ),
            cookies: await page.context().cookies(),
          };
        } finally {
          assetCollector.stop();
        }
      },
    });
    const result = execution.value;

    await syncBrowserCookiesToJar(client.jar, result.cookies);
    const parsed = result.stream ? parseGrokConversationStream(result.stream) : undefined;
    const derivedConversationId = extractGrokImaginePostId(result.pageUrl);
    return {
      assetUrls: dedupeValues([...result.collectedAssetUrls, ...result.assetUrls]),
      conversationId: derivedConversationId ?? parsed?.conversationId,
      parsed,
    };
  }

  private async ensureBrowserAuthenticated(page: PlaywrightPage): Promise<void> {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1_000);

    const url = page.url().toLowerCase();
    if (url.includes("/login") || url.includes("/sign-in")) {
      throw new MikaCliError("GROK_BROWSER_NOT_LOGGED_IN", "The browser session is not logged into Grok. Run `mikacli llm grok login --browser` first.");
    }

    const bodyText = normalizeWhitespace(await page.locator("body").innerText().catch(() => ""));
    if (!bodyText) {
      return;
    }

    const blockedPatterns = [
      /sign in/i,
      /log in/i,
      /access denied/i,
      /something went wrong/i,
      /try again later/i,
      /unusual activity/i,
    ];

    for (const pattern of blockedPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        if (/sign in|log in/i.test(match[0])) {
          throw new MikaCliError("GROK_BROWSER_NOT_LOGGED_IN", "The browser session is not logged into Grok. Run `mikacli llm grok login --browser` first.");
        }

        throw new MikaCliError("GROK_BROWSER_ACTION_FAILED", match[0], {
          details: {
            url: page.url(),
          },
        });
      }
    }
  }

  private async submitChatPromptInBrowser(page: PlaywrightPage, prompt: string, timeoutSeconds?: number): Promise<string> {
    const responsePromise = this.captureBrowserConversationStream(page, Math.min((timeoutSeconds ?? 180) * 1000, 90_000));
    await this.fillAndSubmitBrowserComposer(page, prompt, Math.min((timeoutSeconds ?? 180) * 1000, 20_000));
    return responsePromise;
  }

  private async submitImaginePromptInBrowser(
    page: PlaywrightPage,
    prompt: string,
    mode: "image" | "video",
    timeoutSeconds?: number,
  ): Promise<string[]> {
    if (mode === "video") {
      const videoMode = page.getByRole("radio", { name: "Video", exact: true }).last();
      await videoMode.waitFor({
        state: "visible",
        timeout: 15_000,
      });
      await videoMode.click();
      await page.waitForTimeout(1_000);
    }

    const existingAssetUrls = await collectImagineAssetUrls(page, mode);
    await this.fillAndSubmitBrowserComposer(page, prompt, Math.min((timeoutSeconds ?? (mode === "video" ? 180 : 120)) * 1000, 20_000));

    const timeoutMs = Math.max(30_000, (timeoutSeconds ?? (mode === "video" ? 180 : 120)) * 1000);
    await page.waitForFunction(
      ({ currentMode, previousUrls }) => {
        const matches = Array.from(
          document.querySelectorAll(currentMode === "video" ? "video, source" : "img"),
          (node) => {
            if (!(node instanceof HTMLElement)) {
              return "";
            }
            const currentSrc = "currentSrc" in node ? String((node as HTMLMediaElement).currentSrc || "") : "";
            const src = currentSrc || node.getAttribute("src") || "";
            const alt = node.getAttribute("alt") || "";
            if (!src || previousUrls.includes(src)) {
              return "";
            }
            if (currentMode === "video") {
              return src.includes("/generated/") || src.includes(".mp4") ? src : "";
            }
            const naturalWidth = node instanceof HTMLImageElement ? node.naturalWidth || 0 : 0;
            const naturalHeight = node instanceof HTMLImageElement ? node.naturalHeight || 0 : 0;
            const isLargeInlineImage = src.startsWith("data:image/") && (naturalWidth >= 512 || naturalHeight >= 512);
            const isRemoteGeneratedImage = src.includes("/generated/") && !src.includes("preview_image");
            const isGeneratedImage =
              isLargeInlineImage ||
              isRemoteGeneratedImage ||
              (alt === "Generated image" && (isLargeInlineImage || isRemoteGeneratedImage));
            if (!isGeneratedImage) return "";
            return src;
          },
        ).filter(Boolean);
        return matches.length > 0;
      },
      {
        currentMode: mode,
        previousUrls: existingAssetUrls,
      },
      {
        timeout: timeoutMs,
      },
    );

    await page.waitForTimeout(mode === "video" ? 3_000 : 3_500);

    const latestAssetUrls = await collectImagineAssetUrls(page, mode);
    return selectRecentImagineAssetUrls(
      latestAssetUrls.filter((url) => !existingAssetUrls.includes(url)),
      mode,
    );
  }

  private async fillAndSubmitBrowserComposer(page: PlaywrightPage, prompt: string, timeoutMs: number): Promise<void> {
    const editor = page.locator("[contenteditable=\"true\"]").first();
    await editor.waitFor({
      state: "visible",
      timeout: timeoutMs,
    });
    await editor.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.type(prompt, {
      delay: 12,
    });
    const submit = page.locator("button[aria-label=\"Submit\"]").last();
    await submit.waitFor({
      state: "visible",
      timeout: timeoutMs,
    });
    await page.waitForFunction(
      () => {
        const submitButton = Array.from(document.querySelectorAll("button[aria-label=\"Submit\"]")).at(-1);
        return submitButton instanceof HTMLButtonElement && !submitButton.disabled;
      },
      {
        timeout: timeoutMs,
      },
    );
    await submit.click({
      force: true,
    });
  }

  private async captureBrowserConversationStream(page: PlaywrightPage, timeoutMs: number): Promise<string> {
    const response = await page.waitForResponse(
      (candidate) => candidate.url().includes("/rest/app-chat/conversations/new"),
      {
        timeout: timeoutMs,
      },
    );
    const body = await response.text();
    if (response.status() !== 200) {
      throw createGrokRequestError(response.status(), body);
    }
    return body;
  }
}

export function inspectGrokHomeHtml(html: string): GrokHomeInspection {
  const subscriptionTierMatch =
    html.match(/"bestSubscription":"([^"]+)"/u) ??
    html.match(/\\"bestSubscription\\":\\"([^"]+)\\"/u);
  const userIdMatch =
    html.match(/"xaiUserId":"([^"]+)"/u) ??
    html.match(/\\"xaiUserId\\":\\"([^"]+)\\"/u);
  const hasAuthenticatedSubscriptionState =
    html.includes("bestSubscription") ||
    html.includes("activeSubscriptions") ||
    html.includes("xaiUserId");

  return {
    isAuthenticated: hasAuthenticatedSubscriptionState,
    subscriptionTier: subscriptionTierMatch?.[1],
    userId: userIdMatch?.[1],
  };
}

export function parseGrokConversationStream(stream: string): ParsedGrokConversationStream {
  const outputCandidates: string[] = [];
  const followUpSuggestions: string[] = [];
  const imageAssets: ParsedGrokGeneratedImageAsset[] = [];
  const videoUpdates: ParsedGrokVideoUpdate[] = [];
  const seenSuggestions = new Set<string>();
  let conversationId: string | undefined;
  let responseId: string | undefined;
  let model: string | undefined;

  for (const rawObject of extractJsonObjects(stream)) {
    let chunk: GrokChunkRecord;
    try {
      chunk = JSON.parse(rawObject) as GrokChunkRecord;
    } catch {
      continue;
    }

    if (chunk.error?.message) {
      throw createGrokChunkError(chunk.error);
    }

    const normalized = normalizeGrokChunkResult(chunk.result);
    if (!normalized) {
      continue;
    }

    if (!conversationId && normalized.conversation?.conversationId) {
      conversationId = normalized.conversation.conversationId;
    }

    const modelResponse = normalized.response?.modelResponse;
    if (modelResponse?.responseId) {
      responseId = modelResponse.responseId;
    }
    if (typeof modelResponse?.model === "string" && modelResponse.model.length > 0) {
      model = modelResponse.model;
    }
    if (typeof modelResponse?.sender === "string" && modelResponse.sender.length > 0 && !model) {
      model = modelResponse.sender;
    }
    if (typeof modelResponse?.message === "string" && modelResponse.message.length > 0) {
      outputCandidates.push(modelResponse.message);
    }

    const suggestions = normalized.response?.finalMetadata?.followUpSuggestions?.suggestions ?? [];
    for (const suggestion of suggestions) {
      const value = suggestion?.suggestion?.trim();
      if (!value || seenSuggestions.has(value)) {
        continue;
      }

      seenSuggestions.add(value);
      followUpSuggestions.push(value);
    }

    const imageAsset = parseGrokGeneratedImageAsset(normalized.response?.cardAttachment?.jsonData);
    if (imageAsset) {
      imageAssets.push(imageAsset);
    }

    const videoUpdate = normalizeGrokVideoUpdate(normalized.response?.streamingVideoGenerationResponse);
    if (videoUpdate) {
      videoUpdates.push(videoUpdate);
    }
  }

  return {
    outputText: selectLongestValue(outputCandidates),
    conversationId,
    responseId,
    model,
    followUpSuggestions,
    imageAssets: selectFinalGrokImageAssets(imageAssets),
    videoUpdates,
  };
}

export function mapGrokError(error: unknown, fallbackMessage: string): MikaCliError {
  if (isMikaCliError(error)) {
    if (error.code === "HTTP_REQUEST_FAILED") {
      return new MikaCliError("GROK_REQUEST_FAILED", fallbackMessage, {
        cause: error,
        details: error.details,
      });
    }

    return error;
  }

  if (error instanceof Error) {
    return new MikaCliError("GROK_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details: {
        message: error.message,
      },
    });
  }

  return new MikaCliError("GROK_REQUEST_FAILED", fallbackMessage);
}

function buildGrokHeaders(input: {
  accept: string;
  contentType?: string;
  includeCorsHints?: boolean;
  referer?: string;
  secFetchSite?: "same-origin" | "same-site" | "none";
}): Record<string, string> {
  return {
    accept: input.accept,
    "accept-language": GROK_ACCEPT_LANGUAGE,
    "user-agent": GROK_USER_AGENT,
    ...(input.contentType ? { "content-type": input.contentType } : {}),
    ...(input.includeCorsHints
      ? {
          origin: "https://grok.com",
          referer: input.referer ?? GROK_HOME_URL,
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": input.secFetchSite ?? "same-origin",
        }
      : {}),
  };
}

function buildGrokCreatePayload(prompt: string, requestedModel?: string): Record<string, unknown> {
  return {
    temporary: false,
    modelName: resolveGrokModel(requestedModel),
    message: prompt,
    fileAttachments: [],
    imageAttachments: [],
    disableSearch: false,
    enableImageGeneration: true,
    returnImageBytes: false,
    returnRawGrokInXaiRequest: false,
    enableImageStreaming: true,
    imageGenerationCount: 2,
    forceConcise: false,
    toolOverrides: buildBaseToolOverrides(),
    enableSideBySide: true,
    sendFinalMetadata: true,
    isReasoning: false,
    disableTextFollowUps: false,
    responseMetadata: {},
    disableMemory: false,
    forceSideBySide: false,
    isAsyncChat: false,
    disableSelfHarmShortCircuit: false,
    collectionIds: [],
    connectors: [],
    searchAllConnectors: false,
    deviceEnvInfo: buildGrokDeviceEnvInfo(),
    modeId: "auto",
    enable420: false,
  };
}

function buildGrokImageGenerationPayload(prompt: string, requestedModel?: string): Record<string, unknown> {
  return {
    ...buildGrokCreatePayload(`Generate an original image: ${prompt}`.trim(), requestedModel),
    disableSearch: true,
  };
}

function buildGrokVideoPayload(input: {
  prompt: string;
  model?: string;
  imageUuid: string;
  imagePath: string;
}): Record<string, unknown> {
  return {
    ...buildGrokCreatePayload(`${input.imagePath} ${input.prompt} --mode=normal`.trim(), input.model),
    temporary: true,
    fileAttachments: [input.imageUuid],
    enableImageGeneration: false,
    enableImageStreaming: false,
    imageGenerationCount: 0,
    disableSearch: true,
    toolOverrides: {
      ...buildBaseToolOverrides(),
      videoGen: true,
    },
    responseMetadata: {
      experiments: {},
      modelConfigOverride: {
        modelMap: {
          videoGenModelConfig: {
            parentPostId: input.imageUuid,
            aspectRatio: "16:9",
            videoLength: 5,
            isVideoEdit: false,
            resolutionName: "360p",
            isReferenceToVideo: false,
          },
        },
      },
    },
  };
}

function buildBaseToolOverrides(): Record<string, boolean> {
  return {
    gmailSearch: false,
    googleCalendarSearch: false,
    outlookSearch: false,
    outlookCalendarSearch: false,
    googleDriveSearch: false,
  };
}

function buildGrokDeviceEnvInfo(): Record<string, number | boolean> {
  return {
    darkModeEnabled: false,
    devicePixelRatio: 1,
    screenWidth: 1512,
    screenHeight: 982,
    viewportWidth: 1512,
    viewportHeight: 982,
  };
}

function resolveGrokModel(model?: string): string {
  const normalized = model?.trim();
  return normalized && normalized.length > 0 ? normalized : GROK_DEFAULT_MODEL;
}

function normalizeGrokChunkResult(
  result: GrokChunkRecord["result"],
): { response?: GrokStreamingResponseRecord; conversation?: GrokConversationRecord } | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  if ("response" in result || "conversation" in result) {
    const createResult = result as GrokCreateResultRecord;
    return {
      response: createResult.response,
      conversation: createResult.conversation,
    };
  }

  return {
    response: result as GrokStreamingResponseRecord,
  };
}

function parseGrokErrorEnvelope(body: string): GrokErrorEnvelope | undefined {
  try {
    return JSON.parse(body) as GrokErrorEnvelope;
  } catch {
    return undefined;
  }
}

function createGrokRequestError(status: number, body: string): MikaCliError {
  const parsed = parseGrokErrorEnvelope(body);
  const upstreamCode = parsed?.error?.code;
  const upstreamMessage = (parsed?.error?.message ?? body.slice(0, 300)) || "Unknown Grok error.";

  if (status === 401) {
    return new MikaCliError("GROK_SESSION_EXPIRED", "Grok session expired. Re-import cookies.", {
      details: {
        status,
        upstreamCode,
        upstreamMessage,
      },
    });
  }

  if (status === 403 && upstreamCode === 7) {
    return new MikaCliError(
      "GROK_ANTI_BOT_BLOCKED",
      "Grok rejected the browserless request with its current anti-bot rules. The session appears valid in the web app, but Grok is blocking terminal prompts right now.",
      {
        details: {
          status,
          upstreamCode,
          upstreamMessage,
        },
      },
    );
  }

  if (typeof upstreamMessage === "string" && upstreamMessage.includes("invalid-credentials")) {
    return new MikaCliError("GROK_SESSION_EXPIRED", "Grok session expired. Re-import cookies.", {
      details: {
        status,
        upstreamCode,
        upstreamMessage,
      },
    });
  }

  if (status === 429) {
    return new MikaCliError("GROK_RATE_LIMITED", "Grok rate limited this session. Try again later.", {
      details: {
        status,
        upstreamCode,
        upstreamMessage,
      },
    });
  }

  return new MikaCliError("GROK_REQUEST_FAILED", "Grok rejected the request.", {
    details: {
      status,
      upstreamCode,
      upstreamMessage,
      body: body.slice(0, 500),
    },
  });
}

function createGrokChunkError(error: NonNullable<GrokChunkRecord["error"]>): MikaCliError {
  if (String(error.code ?? "") === "7") {
    return new MikaCliError(
      "GROK_ANTI_BOT_BLOCKED",
      "Grok rejected the browserless request with its current anti-bot rules. The session appears valid in the web app, but Grok is blocking terminal prompts right now.",
      {
        details: {
          upstreamCode: error.code,
          upstreamMessage: error.message,
        },
      },
    );
  }

  if (typeof error.message === "string" && error.message.includes("invalid-credentials")) {
    return new MikaCliError("GROK_SESSION_EXPIRED", "Grok session expired. Re-import cookies.", {
      details: {
        upstreamCode: error.code,
        upstreamMessage: error.message,
      },
    });
  }

  return new MikaCliError("GROK_STREAM_ERROR", error.message ?? "Grok returned a stream error.", {
    details: {
      upstreamCode: error.code,
      upstreamMessage: error.message,
      upstreamDetails: error.details,
    },
  });
}

function buildGrokCreateHeaders(statsigId: string): Record<string, string> {
  const sentryTraceId = randomBytes(16).toString("hex");
  const sentrySpanId = randomBytes(8).toString("hex");
  const traceId = randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");

  return {
    accept: "*/*",
    "accept-language": GROK_ACCEPT_LANGUAGE,
    referer: GROK_HOME_URL,
    "content-type": "application/json",
    "x-xai-request-id": randomUUID(),
    "x-statsig-id": statsigId,
    baggage:
      "sentry-environment=production," +
      "sentry-release=00b96a9e9b5a4d9f71fffbfb3a3eb4096e161d00," +
      "sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c," +
      `sentry-trace_id=${sentryTraceId},` +
      "sentry-org_id=4508179396558848," +
      "sentry-sampled=false," +
      `sentry-sample_rand=${Math.random()},` +
      "sentry-sample_rate=0",
    "sentry-trace": `${sentryTraceId}-${sentrySpanId}-0`,
    traceparent: `00-${traceId}-${spanId}-00`,
    origin: "https://grok.com",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  };
}

function shouldRetryGrokBrowserAction(error: unknown): boolean {
  if (!isMikaCliError(error)) {
    return false;
  }

  return (
    error.code === "GROK_ANTI_BOT_BLOCKED" ||
    error.code === "GROK_BROWSER_ACTION_FAILED" ||
    error.code === "GROK_BROWSER_NOT_LOGGED_IN"
  );
}

async function syncBrowserCookiesToJar(jar: CookieJar, cookies: unknown[]): Promise<void> {
  const browserCookies = Array.isArray(cookies) ? cookies : [];

  for (const rawCookie of browserCookies) {
    if (!rawCookie || typeof rawCookie !== "object") {
      continue;
    }

    const value = rawCookie as Record<string, unknown>;
    const cookie = Cookie.fromJSON({
      key: typeof value.name === "string" ? value.name : "",
      value: typeof value.value === "string" ? value.value : "",
      domain: typeof value.domain === "string" ? value.domain : "",
      path: typeof value.path === "string" ? value.path : "/",
      secure: typeof value.secure === "boolean" ? value.secure : undefined,
      httpOnly: typeof value.httpOnly === "boolean" ? value.httpOnly : undefined,
      sameSite: typeof value.sameSite === "string" ? value.sameSite.toLowerCase() : undefined,
      expires:
        typeof value.expires === "number" && Number.isFinite(value.expires) && value.expires > 0
          ? new Date(value.expires * 1000).toISOString()
          : "Infinity",
    });

    if (!cookie) {
      continue;
    }

    const protocol = cookie.secure ? "https" : "http";
    const cookieDomain = typeof cookie.domain === "string" ? cookie.domain : "";
    const domain = cookieDomain.startsWith(".") ? cookieDomain.slice(1) : cookieDomain;
    if (!domain) {
      continue;
    }

    await jar.setCookie(cookie, `${protocol}://${domain}${cookie.path || "/"}`, {
      ignoreError: true,
    });
  }
}

async function waitForOptionalBrowserStream(
  streamPromise: Promise<string | undefined>,
  timeoutMs: number,
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs);

    streamPromise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function withGrokTlsSession<T>(jar: CookieJar, action: (session: SessionClient) => Promise<T>): Promise<T> {
  const moduleClient = new ModuleClient();
  await moduleClient.open();

  const session = new SessionClient(moduleClient, {
    tlsClientIdentifier: GROK_TLS_CLIENT_IDENTIFIER,
    followRedirects: true,
    timeoutSeconds: 30,
    defaultHeaders: GROK_TLS_DEFAULT_HEADERS,
    defaultCookies: await exportJarCookiesForTls(jar, GROK_HOME_URL),
  });

  try {
    const homeResponse = await session.get(GROK_HOME_URL, {
      headers: GROK_HOME_REQUEST_HEADERS,
    });

    await applyTlsCookiesToJar(jar, GROK_HOME_URL, homeResponse.headers);
    session.setDefaultCookies(await exportJarCookiesForTls(jar, GROK_HOME_URL));

    if (homeResponse.status === 403) {
      throw createGrokRequestError(homeResponse.status, homeResponse.body);
    }

    return await action(session);
  } finally {
    await session.destroySession().catch(() => {});
    await moduleClient.terminate().catch(() => {});
  }
}

async function postGrokCreateConversation(
  session: SessionClient,
  jar: CookieJar,
  body: Record<string, unknown>,
  requestOptions?: {
    timeoutSeconds?: number;
  },
): Promise<string> {
  let lastError: MikaCliError | undefined;

  for (const statsigId of GROK_CREATE_STATSIG_IDS) {
    const response = await session.post(GROK_CREATE_CONVERSATION_URL, body, {
      headers: buildGrokCreateHeaders(statsigId),
      headerOrder: [...GROK_CREATE_HEADER_ORDER],
      ...(requestOptions?.timeoutSeconds ? { timeoutSeconds: requestOptions.timeoutSeconds } : {}),
    });

    await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
    session.setDefaultCookies(await exportJarCookiesForTls(jar, GROK_HOME_URL));

    if (response.status === 200) {
      return response.body;
    }

    lastError = createGrokRequestError(response.status, response.body);
    if (lastError.code !== "GROK_ANTI_BOT_BLOCKED") {
      throw lastError;
    }
  }

  throw (
    lastError ??
    new MikaCliError("GROK_REQUEST_FAILED", "Grok rejected the request.", {
      details: {
        url: GROK_CREATE_CONVERSATION_URL,
      },
    })
  );
}

async function pollForGrokVideoUrl(
  session: SessionClient,
  jar: CookieJar,
  input: {
    conversationId?: string;
    videoId?: string;
  },
): Promise<string | undefined> {
  const deadline = Date.now() + GROK_VIDEO_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const candidates = await Promise.all([
      input.conversationId ? fetchGrokConversationResponses(session, jar, input.conversationId) : Promise.resolve(undefined),
      input.conversationId ? fetchGrokConversationV2(session, jar, input.conversationId) : Promise.resolve(undefined),
      input.videoId ? fetchGrokMediaPost(session, jar, input.videoId) : Promise.resolve(undefined),
    ]);

    for (const candidate of candidates) {
      const videoUrl = extractGrokVideoUrl(candidate);
      if (videoUrl) {
        return videoUrl;
      }
    }

    await delay(GROK_VIDEO_POLL_INTERVAL_MS);
  }

  return undefined;
}

async function inspectGrokVideoJob(
  session: SessionClient,
  jar: CookieJar,
  input: {
    conversationId?: string;
    videoId?: string;
    responseId?: string;
    model?: string;
    progress?: number;
    outputText?: string;
    outputUrl?: string;
  },
): Promise<GrokVideoStatusResult> {
  const responseBodies = await Promise.all([
    input.conversationId ? fetchGrokConversationResponses(session, jar, input.conversationId) : Promise.resolve(undefined),
    input.conversationId ? fetchGrokResponseNodes(session, jar, input.conversationId) : Promise.resolve(undefined),
    input.conversationId ? fetchGrokConversationV2(session, jar, input.conversationId) : Promise.resolve(undefined),
    input.videoId ? fetchGrokMediaPost(session, jar, input.videoId) : Promise.resolve(undefined),
  ]);

  const outputUrl =
    input.outputUrl ??
    responseBodies
      .map((body) => extractGrokVideoUrl(body))
      .find((value): value is string => typeof value === "string" && value.length > 0);
  const progress = selectLargestNumber([
    input.progress,
    ...responseBodies.map((body) => extractGrokVideoProgress(body)),
  ]);
  const inflightResponseIds = dedupeValues(responseBodies.flatMap((body) => extractGrokInflightResponseIds(body)));
  const videoId =
    input.videoId ??
    responseBodies
      .map((body) => extractGrokVideoId(body))
      .find((value): value is string => typeof value === "string" && value.length > 0);
  const responseId =
    input.responseId ??
    responseBodies
      .map((body) => extractGrokResponseId(body))
      .find((value): value is string => typeof value === "string" && value.length > 0);
  const model =
    input.model ??
    responseBodies
      .map((body) => extractGrokModelName(body))
      .find((value): value is string => typeof value === "string" && value.length > 0) ??
    "imagine-video-gen";
  const outputText =
    input.outputText ??
    responseBodies
      .map((body) => extractGrokAssistantMessage(body))
      .find((value): value is string => typeof value === "string" && value.length > 0) ??
    "";

  const status: GrokVideoStatusResult["status"] = outputUrl
    ? "completed"
    : inflightResponseIds.length > 0 || typeof progress === "number" || input.conversationId || input.videoId
      ? "processing"
      : "unknown";
  const message =
    status === "completed"
      ? "The Grok video asset is ready to download."
      : status === "processing"
        ? "The Grok video job is still processing."
        : "Could not confirm the Grok video job status from the current browserless endpoints.";

  return {
    outputText,
    conversationId: input.conversationId,
    responseId,
    model,
    followUpSuggestions: [],
    status,
    message,
    outputUrl,
    outputUrls: outputUrl ? [outputUrl] : [],
    outputPaths: [],
    videoId,
    progress,
    inflightResponseIds,
  };
}

async function fetchGrokConversationResponses(
  session: SessionClient,
  jar: CookieJar,
  conversationId: string,
): Promise<string | undefined> {
  const url = `https://grok.com/rest/app-chat/conversations/${encodeURIComponent(conversationId)}/responses?includeThreads=true`;
  const response = await session.get(url, {
    headers: buildGrokHeaders({
      accept: "application/json, text/plain, */*",
      includeCorsHints: true,
    }),
  });
  await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
  return response.status === 200 ? response.body : undefined;
}

async function fetchGrokConversationV2(
  session: SessionClient,
  jar: CookieJar,
  conversationId: string,
): Promise<string | undefined> {
  const url = `https://grok.com/rest/app-chat/conversations_v2/${encodeURIComponent(conversationId)}?includeTaskResult=true`;
  const response = await session.get(url, {
    headers: buildGrokHeaders({
      accept: "application/json, text/plain, */*",
      includeCorsHints: true,
    }),
  });
  await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
  return response.status === 200 ? response.body : undefined;
}

async function fetchGrokResponseNodes(
  session: SessionClient,
  jar: CookieJar,
  conversationId: string,
): Promise<string | undefined> {
  const url = `https://grok.com/rest/app-chat/conversations/${encodeURIComponent(conversationId)}/response-node?includeThreads=true`;
  const response = await session.get(url, {
    headers: buildGrokHeaders({
      accept: "application/json, text/plain, */*",
      includeCorsHints: true,
    }),
  });
  await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
  return response.status === 200 ? response.body : undefined;
}

async function fetchGrokMediaPost(
  session: SessionClient,
  jar: CookieJar,
  mediaId: string,
): Promise<string | undefined> {
  const response = await session.post(
    GROK_MEDIA_POST_URL,
    {
      id: mediaId,
      isKidsMode: false,
      isNsfwEnabled: true,
      withContainerOnly: false,
    },
    {
      headers: buildGrokHeaders({
        accept: "application/json, text/plain, */*",
        contentType: "application/json",
        includeCorsHints: true,
      }),
    },
  );

  await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
  return response.status === 200 ? response.body : undefined;
}

async function downloadGrokAsset(
  session: SessionClient,
  jar: CookieJar,
  assetUrl: string,
  kind: "images" | "videos",
  input: {
    prefix: string;
    outputDir?: string;
  },
): Promise<string> {
  const response = await session.get(assetUrl, {
    isByteResponse: true,
    headers: buildGrokHeaders({
      accept: kind === "videos" ? "video/*,*/*;q=0.8" : "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      includeCorsHints: true,
      referer: GROK_HOME_URL,
      secFetchSite: "same-site",
    }),
  });

  await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
  if (response.status !== 200) {
    throw createGrokRequestError(response.status, response.body);
  }

  const outputPath = buildGrokAssetOutputPath(kind, input.prefix, assetUrl, input.outputDir);
  await ensureParentDirectory(outputPath);
  await writeFile(outputPath, decodeTlsBinaryBody(response.body));
  return outputPath;
}

async function downloadBrowserAccessibleAsset(
  client: SessionHttpClient,
  assetUrl: string,
  kind: "images" | "videos",
  input: {
    prefix: string;
    outputDir?: string;
    referer?: string;
  },
): Promise<string> {
  const response = await client.requestWithResponse<ArrayBuffer>(assetUrl, {
    responseType: "arrayBuffer",
    expectedStatus: 200,
    headers: {
      accept: kind === "videos" ? "video/*,*/*;q=0.8" : "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: input.referer ?? GROK_IMAGINE_URL,
      "user-agent": GROK_USER_AGENT,
    },
  });

  const outputPath = buildGrokAssetOutputPath(kind, input.prefix, assetUrl, input.outputDir);
  await ensureParentDirectory(outputPath);
  await writeFile(outputPath, Buffer.from(response.data));
  return outputPath;
}

async function writeGrokBrowserAsset(
  source: string,
  kind: "images" | "videos",
  input: {
    prefix: string;
    outputDir?: string;
  },
): Promise<string> {
  const outputPath = buildGrokBrowserAssetOutputPath(kind, input.prefix, source, input.outputDir);
  await ensureParentDirectory(outputPath);
  await writeFile(outputPath, decodeTlsBinaryBody(source));
  return outputPath;
}

function buildGrokAssetOutputPath(
  kind: "images" | "videos",
  prefix: string,
  assetUrl: string,
  outputDir?: string,
): string {
  const url = new URL(assetUrl);
  const extension = extname(url.pathname) || (kind === "videos" ? ".mp4" : ".jpg");
  const fileName = `${sanitizeFileFragment(prefix)}-${randomUUID()}${extension}`;
  if (outputDir) {
    return join(outputDir, fileName);
  }
  return getCachePath("grok", "generated", kind, fileName);
}

function buildGrokBrowserAssetOutputPath(
  kind: "images" | "videos",
  prefix: string,
  source: string,
  outputDir?: string,
): string {
  if (!isDataUri(source)) {
    return buildGrokAssetOutputPath(kind, prefix, source, outputDir);
  }

  const extension = resolveDataUriExtension(source, kind);
  const fileName = `${sanitizeFileFragment(prefix)}-${randomUUID()}${extension}`;
  if (outputDir) {
    return join(outputDir, fileName);
  }
  return getCachePath("grok", "generated", kind, fileName);
}

function sanitizeFileFragment(value: string): string {
  return value.replace(/[^a-z0-9._-]+/giu, "-").replace(/^-+|-+$/gu, "").slice(0, 80) || "grok";
}

function decodeTlsBinaryBody(body: string): Buffer {
  const commaIndex = body.indexOf(",");
  if (body.startsWith("data:") && commaIndex >= 0) {
    const metadata = body.slice(0, commaIndex);
    const payload = body.slice(commaIndex + 1);
    return metadata.includes(";base64") ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  }

  return Buffer.from(body, "base64");
}

function isDataUri(value: string): boolean {
  return value.startsWith("data:");
}

function resolveDataUriExtension(source: string, kind: "images" | "videos"): string {
  const mimeMatch = source.match(/^data:([^;,]+)/u);
  const mime = mimeMatch?.[1]?.toLowerCase() ?? "";
  if (mime.endsWith("png")) {
    return ".png";
  }
  if (mime.endsWith("webp")) {
    return ".webp";
  }
  if (mime.endsWith("gif")) {
    return ".gif";
  }
  if (mime.endsWith("mp4")) {
    return ".mp4";
  }
  return kind === "videos" ? ".mp4" : ".jpg";
}

function resolveGrokAssetUrl(assetPathOrUrl: string): string {
  if (/^https?:\/\//u.test(assetPathOrUrl)) {
    return assetPathOrUrl;
  }

  return new URL(assetPathOrUrl.replace(/^\/+/u, ""), GROK_ASSET_BASE_URL).toString();
}

function createGrokGeneratedAssetCollector(
  page: PlaywrightPage,
  mode: "image" | "video",
): { stop: () => string[] } {
  const assetUrls = new Set<string>();
  let active = true;
  const onResponse = (response: { url(): string; status(): number }) => {
    if (!active || response.status() < 200 || response.status() >= 400) {
      return;
    }

    const url = response.url();
    if (!isBrowserGeneratedAssetUrl(url, mode)) {
      return;
    }

    assetUrls.add(url);
  };

  page.on("response", onResponse);

  return {
    stop: () => {
      if (!active) {
        return Array.from(assetUrls);
      }

      active = false;
      page.off("response", onResponse);
      return Array.from(assetUrls);
    },
  };
}

async function collectImagineAssetUrls(page: PlaywrightPage, mode: "image" | "video"): Promise<string[]> {
  return page.evaluate((currentMode) => {
    const elements = Array.from(document.querySelectorAll(currentMode === "video" ? "video, source" : "img"));
    const urls = elements
      .map((node) => {
        if (!(node instanceof HTMLElement)) {
          return "";
        }

        const currentSrc = "currentSrc" in node ? String((node as HTMLMediaElement).currentSrc || "") : "";
        const src = currentSrc || node.getAttribute("src") || "";
        if (!src) {
          return "";
        }

        if (currentMode === "video") {
          return src.includes("/generated/") || src.includes(".mp4") ? src : "";
        }

        const alt = node.getAttribute("alt") || "";
        const naturalWidth = node instanceof HTMLImageElement ? node.naturalWidth || 0 : 0;
        const naturalHeight = node instanceof HTMLImageElement ? node.naturalHeight || 0 : 0;
        const isLargeInlineImage = src.startsWith("data:image/") && (naturalWidth >= 512 || naturalHeight >= 512);
        const isRemoteGeneratedImage = src.includes("/generated/") && !src.includes("preview_image");
        const isGeneratedImage =
          isLargeInlineImage ||
          isRemoteGeneratedImage ||
          (alt === "Generated image" && (isLargeInlineImage || isRemoteGeneratedImage));
        if (!isGeneratedImage || alt === "pfp" || alt === "Most recent favorite") {
          return "";
        }

        return src;
      })
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set(urls));
  }, mode);
}

function selectRecentImagineAssetUrls(assetUrls: readonly string[], mode: "image" | "video"): string[] {
  const unique = dedupeValues(assetUrls);
  if (mode === "video") {
    return unique.slice(-1);
  }

  const remoteFinal = unique.filter((url) => !isDataUri(url) && !isPreviewImagineAssetUrl(url));
  const inline = unique.filter((url) => isDataUri(url));
  const remotePreview = unique.filter((url) => !isDataUri(url) && isPreviewImagineAssetUrl(url));
  if (inline.length > 0) {
    const bestInline = [...inline].sort((left, right) => left.length - right.length).at(-1);
    return bestInline ? [bestInline] : [];
  }

  if (remoteFinal.length > 0) {
    return remoteFinal.slice(-1);
  }

  return remotePreview.slice(-1);
}

function isBrowserGeneratedAssetUrl(url: string, mode: "image" | "video"): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "assets.grok.com" || !parsed.pathname.includes("/generated/")) {
      return false;
    }

    const path = parsed.pathname.toLowerCase();
    if (mode === "video") {
      return path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".webm") || path.includes("generated_video");
    }

    if (path.includes("preview_image")) {
      return false;
    }

    return (
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".png") ||
      path.endsWith(".webp") ||
      path.includes("generated_image")
    );
  } catch {
    return false;
  }
}

function isPreviewImagineAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().includes("preview_image");
  } catch {
    return false;
  }
}

function resolveBrowserImagineImageUrls(input: {
  assetUrls: readonly string[];
  parsed?: ParsedGrokConversationStream;
}): string[] {
  const browserOutputUrls = selectRecentImagineAssetUrls(input.assetUrls, "image");
  if (browserOutputUrls.length > 0) {
    return browserOutputUrls;
  }

  const parsedOutputUrls = (input.parsed?.imageAssets ?? []).map((asset) => resolveGrokAssetUrl(asset.assetPath));
  if (parsedOutputUrls.length > 0) {
    return dedupeValues(parsedOutputUrls);
  }

  return [];
}

function resolveBrowserImagineVideoUrl(
  input: {
    assetUrls: readonly string[];
    parsed?: ParsedGrokConversationStream;
  },
  latestVideoUpdate?: ParsedGrokVideoUpdate,
): string | undefined {
  if (latestVideoUpdate?.videoUrl) {
    return resolveGrokAssetUrl(latestVideoUpdate.videoUrl);
  }

  return selectRecentImagineAssetUrls(input.assetUrls, "video")[0];
}

function extractGrokImaginePostId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/imagine\/post\/([^/]+)$/u);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function parseGrokGeneratedImageAsset(jsonData?: string): ParsedGrokGeneratedImageAsset | undefined {
  if (!jsonData) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonData) as GrokGeneratedImageCardRecord;
    const isGeneratedImageCard =
      parsed.cardType === "generated_image_card" || parsed.type === "render_generated_image";
    const assetPath = parsed.image_chunk?.imageUrl?.trim();

    if (!isGeneratedImageCard || !assetPath) {
      return undefined;
    }

    return {
      imageUuid: parsed.image_chunk?.imageUuid?.trim() || undefined,
      assetPath,
      progress: typeof parsed.image_chunk?.progress === "number" ? parsed.image_chunk.progress : undefined,
      cardId: parsed.id?.trim() || undefined,
    };
  } catch {
    return undefined;
  }
}

function normalizeGrokVideoUpdate(
  update?: GrokStreamingVideoGenerationRecord,
): ParsedGrokVideoUpdate | undefined {
  if (!update || typeof update !== "object") {
    return undefined;
  }

  if (
    typeof update.videoId !== "string" &&
    typeof update.videoUrl !== "string" &&
    typeof update.progress !== "number"
  ) {
    return undefined;
  }

  return {
    videoId: update.videoId?.trim() || undefined,
    videoUrl: update.videoUrl?.trim() || undefined,
    progress: typeof update.progress === "number" ? update.progress : undefined,
    modelName: update.modelName?.trim() || undefined,
    resolutionName: update.resolutionName?.trim() || undefined,
    mode: update.mode?.trim() || undefined,
    parentPostId: update.parentPostId?.trim() || undefined,
    videoPostId: update.videoPostId?.trim() || undefined,
  };
}

function selectFinalGrokImageAssets(
  assets: readonly ParsedGrokGeneratedImageAsset[],
): ParsedGrokGeneratedImageAsset[] {
  const byKey = new Map<string, ParsedGrokGeneratedImageAsset>();

  for (const asset of assets) {
    const key = asset.imageUuid ?? asset.assetPath;
    const current = byKey.get(key);
    if (!current || shouldReplaceGrokImageAsset(current, asset)) {
      byKey.set(key, asset);
    }
  }

  return [...byKey.values()];
}

function shouldReplaceGrokImageAsset(
  current: ParsedGrokGeneratedImageAsset,
  next: ParsedGrokGeneratedImageAsset,
): boolean {
  const currentIsPartial = /-part-\d+\//u.test(current.assetPath);
  const nextIsPartial = /-part-\d+\//u.test(next.assetPath);

  if ((next.progress ?? -1) !== (current.progress ?? -1)) {
    return (next.progress ?? -1) > (current.progress ?? -1);
  }

  if (currentIsPartial !== nextIsPartial) {
    return !nextIsPartial;
  }

  return next.assetPath.length >= current.assetPath.length;
}

function selectPrimaryGrokImageAsset(
  assets: readonly ParsedGrokGeneratedImageAsset[],
): ParsedGrokGeneratedImageAsset | undefined {
  return selectFinalGrokImageAssets(assets)[0];
}

function selectLatestGrokVideoUpdate(
  updates: readonly ParsedGrokVideoUpdate[],
): ParsedGrokVideoUpdate | undefined {
  let selected: ParsedGrokVideoUpdate | undefined;

  for (const update of updates) {
    if (!selected) {
      selected = update;
      continue;
    }

    if (update.videoUrl && !selected.videoUrl) {
      selected = update;
      continue;
    }

    if ((update.progress ?? -1) >= (selected.progress ?? -1)) {
      selected = update;
    }
  }

  return selected;
}

function extractGrokVideoUrl(body?: string): string | undefined {
  if (!body) {
    return undefined;
  }

  const directMatch = body.match(/https:\/\/assets\.grok\.com\/[^"'\\\s]+\.(?:mp4|mov|webm)/iu);
  if (directMatch?.[0]) {
    return directMatch[0];
  }

  const relativeMatch = body.match(/users\/[^"'\\\s]+\.(?:mp4|mov|webm)/iu);
  if (relativeMatch?.[0]) {
    return resolveGrokAssetUrl(relativeMatch[0]);
  }

  try {
    return extractGrokVideoUrlFromValue(JSON.parse(body));
  } catch {
    return undefined;
  }
}

function extractGrokVideoProgress(body?: string): number | undefined {
  if (!body) {
    return undefined;
  }

  try {
    return extractGrokVideoProgressFromValue(JSON.parse(body));
  } catch {
    return undefined;
  }
}

function extractGrokVideoProgressFromValue(value: unknown): number | undefined {
  let max: number | undefined;

  visitJson(value, (entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }

    const progress = (entry as { progress?: unknown }).progress;
    if (typeof progress === "number") {
      max = typeof max === "number" ? Math.max(max, progress) : progress;
    }
  });

  return max;
}

function extractGrokInflightResponseIds(body?: string): string[] {
  if (!body) {
    return [];
  }

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const values: string[] = [];
    visitJson(parsed, (entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return;
      }

      const inflight = (entry as { inflightResponses?: unknown }).inflightResponses;
      if (!Array.isArray(inflight)) {
        return;
      }

      for (const item of inflight) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          continue;
        }

        const responseId = (item as { responseId?: unknown }).responseId;
        if (typeof responseId === "string" && responseId.length > 0) {
          values.push(responseId);
        }
      }
    });

    return dedupeValues(values);
  } catch {
    return [];
  }
}

function extractGrokVideoId(body?: string): string | undefined {
  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body);
    let value: string | undefined;
    visitJson(parsed, (entry) => {
      if (value || !entry || typeof entry !== "object" || Array.isArray(entry)) {
        return;
      }

      const direct = (entry as { videoId?: unknown }).videoId;
      if (typeof direct === "string" && direct.length > 0) {
        value = direct;
      }
    });
    return value;
  } catch {
    return undefined;
  }
}

function extractGrokResponseId(body?: string): string | undefined {
  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (Array.isArray(parsed.responses)) {
      const assistant = [...parsed.responses]
        .reverse()
        .find(
          (entry): entry is { responseId?: unknown; sender?: unknown } =>
            Boolean(entry) && typeof entry === "object" && !Array.isArray(entry) && (entry as { sender?: unknown }).sender !== "human",
        );
      if (assistant && typeof assistant.responseId === "string" && assistant.responseId.length > 0) {
        return assistant.responseId;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function extractGrokModelName(body?: string): string | undefined {
  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body);
    let value: string | undefined;
    visitJson(parsed, (entry) => {
      if (value || !entry || typeof entry !== "object" || Array.isArray(entry)) {
        return;
      }

      const direct =
        typeof (entry as { modelName?: unknown }).modelName === "string"
          ? ((entry as { modelName?: string }).modelName ?? undefined)
          : typeof (entry as { model?: unknown }).model === "string"
            ? ((entry as { model?: string }).model ?? undefined)
            : undefined;
      if (direct && direct.length > 0) {
        value = direct;
      }
    });
    return value;
  } catch {
    return undefined;
  }
}

function extractGrokAssistantMessage(body?: string): string | undefined {
  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (!Array.isArray(parsed.responses)) {
      return undefined;
    }

    const messages = parsed.responses
      .filter(
        (entry): entry is { sender?: unknown; message?: unknown } =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry) && (entry as { sender?: unknown }).sender !== "human",
      )
      .map((entry) => (typeof entry.message === "string" ? entry.message : ""))
      .filter((value): value is string => value.length > 0);

    return selectLongestValue(messages);
  } catch {
    return undefined;
  }
}

function extractGrokVideoUrlFromValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    if (/^https:\/\/assets\.grok\.com\/.+\.(?:mp4|mov|webm)$/iu.test(value)) {
      return value;
    }

    if (/^users\/.+\.(?:mp4|mov|webm)$/iu.test(value)) {
      return resolveGrokAssetUrl(value);
    }

    return undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const next = extractGrokVideoUrlFromValue(entry);
      if (next) {
        return next;
      }
    }
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === "videoUrl" && typeof entry === "string" && entry.length > 0) {
      return resolveGrokAssetUrl(entry);
    }

    const next = extractGrokVideoUrlFromValue(entry);
    if (next) {
      return next;
    }
  }

  return undefined;
}

function visitJson(value: unknown, visit: (entry: unknown) => void): void {
  visit(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      visitJson(entry, visit);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const entry of Object.values(value)) {
    visitJson(entry, visit);
  }
}

function dedupeValues(values: readonly string[]): string[] {
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

function selectLargestNumber(values: Array<number | undefined>): number | undefined {
  let selected: number | undefined;
  for (const value of values) {
    if (typeof value !== "number") {
      continue;
    }

    selected = typeof selected === "number" ? Math.max(selected, value) : value;
  }
  return selected;
}

async function stopGrokConversationInflightResponses(
  session: SessionClient,
  jar: CookieJar,
  conversationId: string,
): Promise<void> {
  const url = `https://grok.com/rest/app-chat/conversations/${encodeURIComponent(conversationId)}/stop-inflight-responses`;
  const response = await session.post(
    url,
    null,
    {
      headers: buildGrokHeaders({
        accept: "application/json, text/plain, */*",
        includeCorsHints: true,
      }),
    },
  );
  await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
}

async function stopGrokInflightResponse(
  session: SessionClient,
  jar: CookieJar,
  responseId: string,
): Promise<void> {
  const url = `https://grok.com/rest/app-chat/conversations/inflight-response/${encodeURIComponent(responseId)}`;
  const response = await session.delete(url, {
    headers: buildGrokHeaders({
      accept: "application/json, text/plain, */*",
      includeCorsHints: true,
    }),
  });
  await applyTlsCookiesToJar(jar, GROK_HOME_URL, response.headers);
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

function extractJsonObjects(input: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (start === -1) {
      if (character === "{") {
        start = index;
        depth = 1;
        inString = false;
        escaping = false;
      }
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (character === "\\") {
        escaping = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        objects.push(input.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function selectLongestValue(values: readonly string[]): string {
  let selected = "";
  for (const value of values) {
    if (value.length >= selected.length) {
      selected = value;
    }
  }
  return selected;
}

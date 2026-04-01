import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { createMediaJobRecord, MediaJobStore } from "../../../core/media-jobs/store.js";
import { AutoCliError, isAutoCliError } from "../../../errors.js";
import { GrokService } from "./service.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  LoginInput,
  PlatformSession,
} from "../../../types.js";
import type { MediaJobRecord } from "../../../core/media-jobs/store.js";
import type { SessionHttpClient } from "../../../utils/http-client.js";

export class GrokAdapter extends CookieLlmAdapter {
  private readonly service = new GrokService();
  private readonly mediaJobStore = new MediaJobStore();

  constructor() {
    super({
      platform: "grok",
      defaultModel: "grok-3",
      textUnsupportedMessage:
        "Grok text prompting is temporarily unavailable.",
      imageUnsupportedMessage:
        "Grok image generation should use the prompt-based `image` command.",
      videoUnsupportedMessage:
        "Grok video generation should use the prompt-based `video` command.",
    });
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const result = await super.login(input);
    return this.refreshSavedSession(result.account, result.sessionPath);
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      jar: inspection.jar,
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
        ...(inspection.subscriptionTier ? { subscriptionTier: inspection.subscriptionTier } : {}),
      },
    });

    return this.buildStatusResult({
      account: persisted.account,
      sessionPath: path,
      status: inspection.status,
      user: inspection.user,
    });
  }

  async text(input: {
    account?: string;
    prompt: string;
    model?: string;
    browser?: boolean;
    browserTimeoutSeconds?: number;
  }): Promise<AdapterActionResult> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new AutoCliError("INVALID_PROMPT", "Expected a non-empty Grok text prompt.");
    }

    const session = await this.ensureActiveSession(input.account);
    return this.executeText(session, {
      ...input,
      prompt,
      model: input.model?.trim() || "grok-3",
    });
  }

  async generateImage(input: {
    account?: string;
    prompt: string;
    model?: string;
    browser?: boolean;
    browserTimeoutSeconds?: number;
  }): Promise<AdapterActionResult> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new AutoCliError("INVALID_PROMPT", "Expected a non-empty Grok image prompt.");
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);

    try {
      const result = await this.service.executeImage(client, {
        prompt,
        model: input.model?.trim() || "grok-3",
        browser: Boolean(input.browser),
        browserTimeoutSeconds: input.browserTimeoutSeconds,
      });

      await this.persistActiveSession(session, client.jar, result.model);
      const { job, path: jobPath } = await this.upsertImageJob({
        account: session.account,
        prompt,
        result: {
          ...result,
          status: "completed",
          message: `Grok generated ${result.outputPaths.length || result.outputUrls.length} image${result.outputPaths.length === 1 || result.outputUrls.length === 1 ? "" : "s"} using ${result.model}.`,
        },
      });

      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "image",
        message: job.message ?? `Grok generated ${result.outputPaths.length || result.outputUrls.length} image${result.outputPaths.length === 1 || result.outputUrls.length === 1 ? "" : "s"} using ${result.model}.`,
        id: result.responseId,
        url: result.conversationId ? `https://grok.com/c/${result.conversationId}` : undefined,
        data: {
          jobId: job.jobId,
          jobPath,
          status: job.status,
          model: result.model,
          conversationId: result.conversationId,
          responseId: result.responseId,
          outputText: result.outputText,
          followUpSuggestions: result.followUpSuggestions,
          outputPaths: result.outputPaths,
          outputUrls: result.outputUrls,
          providerJobId: job.providerJobId,
        },
      };
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  async generateVideo(input: {
    account?: string;
    prompt: string;
    model?: string;
    browser?: boolean;
    browserTimeoutSeconds?: number;
  }): Promise<AdapterActionResult> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new AutoCliError("INVALID_PROMPT", "Expected a non-empty Grok video prompt.");
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);

    try {
      const result = await this.service.executeVideo(client, {
        prompt,
        model: input.model?.trim() || "grok-3",
        browser: Boolean(input.browser),
        browserTimeoutSeconds: input.browserTimeoutSeconds,
      });

      await this.persistActiveSession(session, client.jar, result.model);
      const actionMessage =
        result.status === "completed"
          ? `Grok generated a video using ${result.model}.`
          : `Grok accepted the video generation job using ${result.model}, but the final asset URL is still pending.`;
      const { job, path: jobPath } = await this.upsertVideoJob({
        account: session.account,
        prompt,
        result: {
          ...result,
          message: actionMessage,
        },
      });

      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "video",
        message: actionMessage,
        id: result.responseId,
        url: result.conversationId ? `https://grok.com/c/${result.conversationId}` : undefined,
        data: {
          jobId: job.jobId,
          jobPath,
          model: result.model,
          status: result.status,
          conversationId: result.conversationId,
          responseId: result.responseId,
          outputText: result.outputText,
          followUpSuggestions: result.followUpSuggestions,
          outputPaths: result.outputPaths,
          outputUrl: result.outputUrl,
          outputUrls: result.outputUrls,
          videoId: result.videoId,
          progress: result.progress,
          seedImageUrl: result.seedImageUrl,
          seedImagePath: result.seedImagePath,
        },
      };
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  async imageDownload(input: {
    account?: string;
    target: string;
    outputDir?: string;
  }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new AutoCliError("INVALID_TARGET", "Expected a Grok image job target.");
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);
    const existing = await this.findImageJob(target);

    if (!existing) {
      throw new AutoCliError("MEDIA_JOB_NOT_FOUND", `No saved ${this.platform} image job was found for ${target}.`, {
        details: {
          platform: this.platform,
          target,
          kind: "image",
        },
      });
    }

    const outputUrls = existing.job.outputUrls ?? [];
    if (outputUrls.length === 0) {
      throw new AutoCliError(
        "GROK_IMAGE_DOWNLOAD_UNAVAILABLE",
        "The saved Grok image job does not include any downloadable asset URLs.",
        {
          details: {
            platform: this.platform,
            target,
            jobId: existing.job.jobId,
          },
        },
      );
    }

    try {
      const downloadResult =
        input.outputDir || (existing.job.outputPaths?.length ?? 0) === 0
          ? await this.service.downloadImages(client, {
              conversationId: existing.job.conversationId,
              outputUrls,
              outputDir: input.outputDir,
            })
          : {
              outputUrls,
              outputPaths: existing.job.outputPaths ?? [],
            };
      const persisted = await this.upsertImageJob({
        existingJob: existing.job,
        account: existing.job.account,
        result: {
          status: "completed",
          message:
            input.outputDir || (existing.job.outputPaths?.length ?? 0) === 0
              ? `Downloaded ${downloadResult.outputPaths.length} Grok image${downloadResult.outputPaths.length === 1 ? "" : "s"}.`
              : "Loaded the saved Grok image outputs.",
          model: readStringMetadata(existing.job.metadata, "model") ?? "grok-3",
          conversationId: existing.job.conversationId,
          responseId: existing.job.responseId,
          outputText: readStringMetadata(existing.job.metadata, "outputText"),
          outputUrls: downloadResult.outputUrls,
          outputPaths: downloadResult.outputPaths,
          imageUuid: existing.job.providerJobId,
        },
      });

      return this.buildImageJobActionResult(
        session.account,
        "image-download",
        persisted.job,
        persisted.path,
        {
          message: persisted.job.message ?? "Downloaded the Grok image.",
          model: readStringMetadata(persisted.job.metadata, "model") ?? "grok-3",
          conversationId: persisted.job.conversationId,
          responseId: persisted.job.responseId,
          outputText: readStringMetadata(persisted.job.metadata, "outputText"),
          outputUrls: persisted.job.outputUrls,
          outputPaths: persisted.job.outputPaths,
          imageUuid: persisted.job.providerJobId,
          status: persisted.job.status,
        },
      );
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  async videoStatus(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new AutoCliError("INVALID_TARGET", "Expected a Grok video job target.");
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);
    const existing = await this.findVideoJob(target);

    try {
      const result = await this.resolveVideoStatus(client, target, existing?.job);
      const persisted = await this.upsertVideoJob({
        existingJob: existing?.job,
        account: existing?.job.account ?? session.account,
        result,
      });

      return this.buildVideoJobActionResult(session.account, "video-status", persisted.job, persisted.path, result);
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  async videoWait(input: {
    account?: string;
    target: string;
    timeoutMs?: number;
    intervalMs?: number;
  }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new AutoCliError("INVALID_TARGET", "Expected a Grok video job target.");
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);
    const existing = await this.findVideoJob(target);

    try {
      const initial = await this.resolveVideoStatus(client, target, existing?.job);
      const result = await this.service.waitForVideo(client, {
        conversationId: initial.conversationId,
        videoId: initial.videoId,
        responseId: initial.responseId,
        model: initial.model,
        progress: initial.progress,
        outputText: initial.outputText,
        outputUrl: initial.outputUrl,
        timeoutMs: input.timeoutMs,
        intervalMs: input.intervalMs,
      });
      const persisted = await this.upsertVideoJob({
        existingJob: existing?.job,
        account: existing?.job.account ?? session.account,
        result,
      });

      return this.buildVideoJobActionResult(session.account, "video-wait", persisted.job, persisted.path, result);
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  async videoDownload(input: {
    account?: string;
    target: string;
    outputDir?: string;
  }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new AutoCliError("INVALID_TARGET", "Expected a Grok video job target.");
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);
    const existing = await this.findVideoJob(target);

    try {
      const initial = await this.resolveVideoStatus(client, target, existing?.job);
      const result = await this.service.downloadVideo(client, {
        conversationId: initial.conversationId,
        videoId: initial.videoId,
        responseId: initial.responseId,
        model: initial.model,
        progress: initial.progress,
        outputText: initial.outputText,
        outputUrl: initial.outputUrl,
        outputDir: input.outputDir,
      });
      const persisted = await this.upsertVideoJob({
        existingJob: existing?.job,
        account: existing?.job.account ?? session.account,
        result,
      });

      return this.buildVideoJobActionResult(session.account, "video-download", persisted.job, persisted.path, result);
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  async videoCancel(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new AutoCliError("INVALID_TARGET", "Expected a Grok video job target.");
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);
    const existing = await this.findVideoJob(target);

    try {
      const initial = await this.resolveVideoStatus(client, target, existing?.job);
      const result = await this.service.cancelVideo(client, {
        conversationId: initial.conversationId,
        videoId: initial.videoId,
        responseId: initial.responseId,
        model: initial.model,
        progress: initial.progress,
        outputText: initial.outputText,
        outputUrl: initial.outputUrl,
      });
      const persisted = await this.upsertVideoJob({
        existingJob: existing?.job,
        account: existing?.job.account ?? session.account,
        result,
      });

      return this.buildVideoJobActionResult(session.account, "video-cancel", persisted.job, persisted.path, result);
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  protected async executeText(
    session: PlatformSession,
    input: {
      account?: string;
      prompt: string;
      model?: string;
      browser?: boolean;
      browserTimeoutSeconds?: number;
    },
  ): Promise<AdapterActionResult> {
    const client = await this.createClient(session);

    try {
      const result = await this.service.executeText(client, {
        prompt: input.prompt,
        model: input.model,
        browser: Boolean(input.browser),
        browserTimeoutSeconds: input.browserTimeoutSeconds,
      });

      await this.persistExistingSession(session, {
        jar: client.jar,
        user: session.user,
        status: {
          state: "active",
          message: "Grok session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: {
          ...(session.metadata ?? {}),
          defaultModel: result.model,
        },
      });

      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "text",
        message: `Grok replied using ${result.model}.`,
        id: result.responseId,
        url: result.conversationId ? `https://grok.com/c/${result.conversationId}` : undefined,
        data: {
          model: result.model,
          conversationId: result.conversationId,
          responseId: result.responseId,
          outputText: result.outputText,
          followUpSuggestions: result.followUpSuggestions,
          source: input.browser ? "browser" : undefined,
        },
      };
    } catch (error) {
      await this.persistFailureState(session, error);
      throw error;
    }
  }

  private async ensureActiveSession(account?: string): Promise<PlatformSession> {
    const { session } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      jar: inspection.jar,
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
        ...(inspection.subscriptionTier ? { subscriptionTier: inspection.subscriptionTier } : {}),
      },
    });

    if (inspection.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", inspection.status.message ?? "Grok session expired. Re-import cookies.", {
        details: {
          platform: this.platform,
          account: persisted.account,
        },
      });
    }

    return persisted;
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      jar: inspection.jar,
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
        ...(inspection.subscriptionTier ? { subscriptionTier: inspection.subscriptionTier } : {}),
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: persisted.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved Grok session for ${persisted.account}.`
          : `Saved Grok session for ${persisted.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: inspection.user,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    return {
      ...(await this.service.inspectSession(client)),
      jar: client.jar,
    };
  }

  private async persistActiveSession(
    session: PlatformSession,
    jar: Awaited<ReturnType<(typeof this.cookieManager)["createJar"]>>,
    model: string,
  ): Promise<void> {
    await this.persistExistingSession(session, {
      jar,
      user: session.user,
      status: {
        state: "active",
        message: "Grok session is active.",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: model,
      },
    });
  }

  private async persistFailureState(session: PlatformSession, error: unknown): Promise<void> {
    if (!isAutoCliError(error)) {
      return;
    }

    if (error.code === "GROK_SESSION_EXPIRED" || error.code === "SESSION_EXPIRED") {
      await this.persistExistingSession(session, {
        jar: await this.cookieManager.createJar(session),
        status: {
          state: "expired",
          message: error.message,
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: error.code,
        },
      });
      return;
    }

    if (error.code === "GROK_ANTI_BOT_BLOCKED") {
      await this.persistExistingSession(session, {
        jar: await this.cookieManager.createJar(session),
        status: {
          state: "active",
          message: "Grok session is active, but the current browserless write attempt was rejected.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: error.code,
        },
      });
    }
  }

  private async findVideoJob(target: string) {
    return this.mediaJobStore.findJob(this.platform, target, {
      kind: "video",
    });
  }

  private async findImageJob(target: string) {
    return this.mediaJobStore.findJob(this.platform, target, {
      kind: "image",
    });
  }

  private async resolveVideoStatus(
    client: SessionHttpClient,
    target: string,
    existingJob?: MediaJobRecord,
  ) {
    const storedModel = readStringMetadata(existingJob?.metadata, "model");
    const storedProgress = readNumberMetadata(existingJob?.metadata, "progress");
    const storedOutputText = readStringMetadata(existingJob?.metadata, "outputText");

    if (existingJob) {
      return this.service.getVideoStatus(client, {
        conversationId: existingJob.conversationId,
        videoId: existingJob.providerJobId,
        responseId: existingJob.responseId,
        model: storedModel,
        progress: storedProgress,
        outputText: storedOutputText,
        outputUrl: existingJob.outputUrl,
      });
    }

    const byConversation = await this.service.getVideoStatus(client, {
      conversationId: target,
    });

    if (byConversation.status !== "unknown") {
      return byConversation;
    }

    return this.service.getVideoStatus(client, {
      videoId: target,
    });
  }

  private async upsertVideoJob(input: {
    account: string;
    existingJob?: MediaJobRecord;
    prompt?: string;
    result: {
      status: "processing" | "completed" | "canceled" | "failed" | "unknown";
      message?: string;
      model: string;
      conversationId?: string;
      responseId?: string;
      outputText?: string;
      outputUrl?: string;
      outputUrls?: string[];
      outputPaths?: string[];
      videoId?: string;
      progress?: number;
      seedImageUrl?: string;
      seedImagePath?: string;
      inflightResponseIds?: string[];
    };
  }) {
    const job = createMediaJobRecord({
      existingJob: input.existingJob,
      platform: this.platform,
      kind: "video",
      account: input.existingJob?.account ?? input.account,
      status: input.result.status,
      message: input.result.message,
      prompt: input.prompt ?? input.existingJob?.prompt,
      providerJobId: input.result.videoId,
      conversationId: input.result.conversationId,
      responseId: input.result.responseId,
      outputUrl: input.result.outputUrl,
      outputUrls: input.result.outputUrls,
      outputPaths: input.result.outputPaths,
      metadata: {
        model: input.result.model,
        progress: input.result.progress,
        outputText: input.result.outputText,
        ...(input.result.seedImageUrl ? { seedImageUrl: input.result.seedImageUrl } : {}),
        ...(input.result.seedImagePath ? { seedImagePath: input.result.seedImagePath } : {}),
        ...(input.result.inflightResponseIds ? { inflightResponseIds: input.result.inflightResponseIds } : {}),
      },
    });
    const path = await this.mediaJobStore.saveJob(job);
    return { job, path };
  }

  private async upsertImageJob(input: {
    account: string;
    existingJob?: MediaJobRecord;
    prompt?: string;
    result: {
      status: "completed" | "failed" | "unknown";
      message?: string;
      model: string;
      conversationId?: string;
      responseId?: string;
      outputText?: string;
      outputUrls?: string[];
      outputPaths?: string[];
      imageUuid?: string;
    };
  }) {
    const job = createMediaJobRecord({
      existingJob: input.existingJob,
      platform: this.platform,
      kind: "image",
      account: input.existingJob?.account ?? input.account,
      status: input.result.status,
      message: input.result.message,
      prompt: input.prompt ?? input.existingJob?.prompt,
      providerJobId: input.result.imageUuid,
      conversationId: input.result.conversationId,
      responseId: input.result.responseId,
      outputUrls: input.result.outputUrls,
      outputPaths: input.result.outputPaths,
      metadata: {
        model: input.result.model,
        outputText: input.result.outputText,
      },
    });
    const path = await this.mediaJobStore.saveJob(job);
    return { job, path };
  }

  private buildVideoJobActionResult(
    account: string,
    action: string,
    job: MediaJobRecord,
    jobPath: string,
    result: {
      message: string;
      model: string;
      conversationId?: string;
      responseId?: string;
      outputText?: string;
      outputUrl?: string;
      outputUrls?: string[];
      outputPaths?: string[];
      videoId?: string;
      progress?: number;
      status: string;
    },
  ): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account,
      action,
      message: result.message,
      id: result.responseId,
      url: result.conversationId ? `https://grok.com/c/${result.conversationId}` : undefined,
      data: {
        jobId: job.jobId,
        jobPath,
        model: result.model,
        status: result.status,
        conversationId: result.conversationId,
        responseId: result.responseId,
        outputText: result.outputText,
        outputUrl: result.outputUrl,
        outputUrls: result.outputUrls,
        outputPaths: result.outputPaths,
        videoId: result.videoId,
        progress: result.progress,
      },
    };
  }

  private buildImageJobActionResult(
    account: string,
    action: string,
    job: MediaJobRecord,
    jobPath: string,
    result: {
      message: string;
      model: string;
      conversationId?: string;
      responseId?: string;
      outputText?: string;
      outputUrls?: string[];
      outputPaths?: string[];
      imageUuid?: string;
      status: string;
    },
  ): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account,
      action,
      message: result.message,
      id: result.responseId,
      url: result.conversationId ? `https://grok.com/c/${result.conversationId}` : undefined,
      data: {
        jobId: job.jobId,
        jobPath,
        model: result.model,
        status: result.status,
        conversationId: result.conversationId,
        responseId: result.responseId,
        outputText: result.outputText,
        outputUrls: result.outputUrls,
        outputPaths: result.outputPaths,
        providerJobId: result.imageUuid,
      },
    };
  }
}

export const grokAdapter = new GrokAdapter();

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  return typeof metadata?.[key] === "string" ? (metadata[key] as string) : undefined;
}

function readNumberMetadata(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  return typeof metadata?.[key] === "number" ? (metadata[key] as number) : undefined;
}

import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { createMediaJobRecord, MediaJobStore } from "../../../core/media-jobs/store.js";
import { MikaCliError } from "../../../errors.js";
import { GeminiService } from "./service.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession } from "../../../types.js";
import type { MediaJobRecord } from "../../../core/media-jobs/store.js";
import type { CookieJar } from "tough-cookie";

export class GeminiAdapter extends CookieLlmAdapter {
  private readonly service = new GeminiService();
  private readonly mediaJobStore = new MediaJobStore();

  constructor() {
    super({
      platform: "gemini",
      defaultModel: "gemini-3-flash",
      textUnsupportedMessage:
        "Gemini text prompting is temporarily unavailable.",
      imageUnsupportedMessage:
        "Gemini image prompting is temporarily unavailable.",
      videoUnsupportedMessage:
        "Gemini video prompting is temporarily unavailable.",
    });
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const result = await super.login(input);
    return this.refreshSavedSession(result.account, result.sessionPath);
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    await this.persistExistingSession(session, {
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
      },
    });

    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: inspection.status,
      user: session.user,
    });
  }

  protected async executeText(
    session: PlatformSession,
    input: {
      account?: string;
      prompt: string;
      model?: string;
    },
  ): Promise<AdapterActionResult> {
    const client = await this.createClient(session);
    const result = await this.service.executeText(client, {
      prompt: input.prompt,
      model: input.model,
    });

    await this.persistActiveSession(session, client.jar, result.model);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "text",
      message: `Gemini replied using ${result.model}.`,
      id: result.candidateId,
      url: result.url,
      user: session.user,
      data: {
        model: result.model,
        chatId: result.chatId,
        responseId: result.responseId,
        candidateId: result.candidateId,
        outputText: result.outputText,
      },
    };
  }

  protected async executeImage(
    session: PlatformSession,
    input: {
      account?: string;
      mediaPath: string;
      caption?: string;
      model?: string;
    },
  ): Promise<AdapterActionResult> {
    const client = await this.createClient(session);
    const result = await this.service.executeImage(client, {
      mediaPath: input.mediaPath,
      caption: input.caption,
      model: input.model,
    });

    await this.persistActiveSession(session, client.jar, result.model);
    const savedJob =
      (result.outputUrls?.length ?? 0) > 0
        ? await this.upsertMediaJob({
            kind: "image",
            account: session.account,
            prompt: input.caption,
            result: {
              message: `Gemini returned ${result.outputUrls?.length ?? 0} downloadable image output${(result.outputUrls?.length ?? 0) === 1 ? "" : "s"}.`,
              model: result.model,
              status: "completed",
              chatId: result.chatId,
              responseId: result.responseId,
              candidateId: result.candidateId,
              outputText: result.outputText,
              outputUrls: result.outputUrls,
              thumbnailUrls: result.thumbnailUrls,
            },
          })
        : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "image",
      message: `Gemini processed the uploaded image using ${result.model}.`,
      id: result.candidateId,
      url: result.url,
      user: session.user,
      data: {
        ...(savedJob
          ? {
              jobId: savedJob.job.jobId,
              jobPath: savedJob.path,
              status: savedJob.job.status,
            }
          : {}),
        model: result.model,
        chatId: result.chatId,
        responseId: result.responseId,
        candidateId: result.candidateId,
        outputText: result.outputText,
        outputUrls: result.outputUrls,
        thumbnailUrls: result.thumbnailUrls,
      },
    };
  }

  protected async executeVideo(
    session: PlatformSession,
    input: {
      account?: string;
      prompt: string;
      model?: string;
    },
  ): Promise<AdapterActionResult> {
    const client = await this.createClient(session);
    const result = await this.service.executeVideo(client, {
      prompt: input.prompt,
      model: input.model,
    });

    await this.persistActiveSession(session, client.jar, result.model);
    const savedJob = await this.upsertMediaJob({
      kind: "video",
      account: session.account,
      prompt: input.prompt,
      result: {
        message: `Gemini returned ${result.outputUrls?.length ?? 0} downloadable video output${(result.outputUrls?.length ?? 0) === 1 ? "" : "s"}.`,
        model: result.model,
        status: "completed",
        chatId: result.chatId,
        responseId: result.responseId,
        candidateId: result.candidateId,
        outputText: result.outputText,
        outputUrls: result.outputUrls,
        thumbnailUrls: result.thumbnailUrls,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "video",
      message: `Gemini generated video output using ${result.model}.`,
      id: result.candidateId,
      url: result.url,
      user: session.user,
      data: {
        jobId: savedJob.job.jobId,
        jobPath: savedJob.path,
        status: savedJob.job.status,
        model: result.model,
        chatId: result.chatId,
        responseId: result.responseId,
        candidateId: result.candidateId,
        outputText: result.outputText,
        outputUrls: result.outputUrls,
        thumbnailUrls: result.thumbnailUrls,
      },
    };
  }

  async imageDownload(input: {
    account?: string;
    target: string;
    outputDir?: string;
  }): Promise<AdapterActionResult> {
    return this.downloadSavedMedia({
      ...input,
      kind: "image",
      action: "image-download",
    });
  }

  async videoDownload(input: {
    account?: string;
    target: string;
    outputDir?: string;
  }): Promise<AdapterActionResult> {
    return this.downloadSavedMedia({
      ...input,
      kind: "video",
      action: "video-download",
    });
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const client = await this.createClient(session);
    const inspection = await this.service.inspectSession(client);

    await this.persistExistingSession(session, {
      jar: client.jar,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved Gemini session for ${session.account}.`
          : `Saved Gemini session for ${session.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: session.user,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    return this.service.inspectSession(client);
  }

  private async persistActiveSession(session: PlatformSession, jar: CookieJar, model: string): Promise<void> {
    await this.persistExistingSession(session, {
      jar,
      status: {
        state: "active",
        message: "Gemini session is active.",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: model,
      },
    });
  }

  private async ensureActiveSession(account?: string): Promise<PlatformSession> {
    const { session } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
      },
    });

    if (inspection.status.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", inspection.status.message ?? "Gemini session expired. Re-import cookies.", {
        details: {
          platform: this.platform,
          account: persisted.account,
        },
      });
    }

    return persisted;
  }

  private async downloadSavedMedia(input: {
    account?: string;
    target: string;
    outputDir?: string;
    kind: "image" | "video";
    action: "image-download" | "video-download";
  }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("INVALID_TARGET", `Expected a Gemini ${input.kind} job target.`);
    }

    const session = await this.ensureActiveSession(input.account);
    const client = await this.createClient(session);
    const existing = await this.mediaJobStore.findJob(this.platform, target, {
      kind: input.kind,
    });

    if (!existing) {
      throw new MikaCliError("MEDIA_JOB_NOT_FOUND", `No saved Gemini ${input.kind} job was found for ${target}.`, {
        details: {
          platform: this.platform,
          target,
          kind: input.kind,
        },
      });
    }

    const outputUrls = existing.job.outputUrls ?? [];
    if (outputUrls.length === 0) {
      throw new MikaCliError(
        "GEMINI_MEDIA_DOWNLOAD_UNAVAILABLE",
        `The saved Gemini ${input.kind} job does not include any downloadable asset URLs.`,
        {
          details: {
            platform: this.platform,
            target,
            jobId: existing.job.jobId,
            kind: input.kind,
          },
        },
      );
    }

    const downloadResult =
      input.outputDir || (existing.job.outputPaths?.length ?? 0) === 0
        ? await this.service.downloadMedia(client, {
            kind: input.kind,
            outputUrls,
            outputDir: input.outputDir,
            chatId: existing.job.conversationId,
          })
        : {
            outputUrls,
            outputPaths: existing.job.outputPaths ?? [],
          };

    const persisted = await this.upsertMediaJob({
      existingJob: existing.job,
      kind: input.kind,
      account: existing.job.account,
      result: {
        message:
          input.outputDir || (existing.job.outputPaths?.length ?? 0) === 0
            ? `Downloaded ${downloadResult.outputPaths.length} Gemini ${input.kind}${downloadResult.outputPaths.length === 1 ? "" : "s"}.`
            : `Loaded the saved Gemini ${input.kind} outputs.`,
        model: readStringMetadata(existing.job.metadata, "model") ?? "gemini-3-flash",
        status: "completed",
        chatId: existing.job.conversationId,
        responseId: existing.job.responseId,
        candidateId: existing.job.providerJobId,
        outputText: readStringMetadata(existing.job.metadata, "outputText"),
        outputUrls: downloadResult.outputUrls,
        outputPaths: downloadResult.outputPaths,
        thumbnailUrls: readStringArrayMetadata(existing.job.metadata, "thumbnailUrls"),
      },
    });

    return this.buildMediaJobActionResult({
      account: session.account,
      action: input.action,
      kind: input.kind,
      job: persisted.job,
      jobPath: persisted.path,
    });
  }

  private async upsertMediaJob(input: {
    account: string;
    kind: "image" | "video";
    prompt?: string;
    existingJob?: MediaJobRecord;
    result: {
      message: string;
      model: string;
      status: "completed" | "failed" | "unknown";
      chatId?: string;
      responseId?: string;
      candidateId?: string;
      outputText?: string;
      outputUrls?: string[];
      outputPaths?: string[];
      thumbnailUrls?: string[];
    };
  }) {
    const job = createMediaJobRecord({
      existingJob: input.existingJob,
      platform: this.platform,
      kind: input.kind,
      account: input.existingJob?.account ?? input.account,
      status: input.result.status,
      message: input.result.message,
      prompt: input.prompt ?? input.existingJob?.prompt,
      providerJobId: input.result.candidateId,
      conversationId: input.result.chatId,
      responseId: input.result.responseId,
      outputUrls: input.result.outputUrls,
      outputPaths: input.result.outputPaths,
      metadata: {
        model: input.result.model,
        outputText: input.result.outputText,
        thumbnailUrls: input.result.thumbnailUrls,
      },
    });
    const path = await this.mediaJobStore.saveJob(job);
    return { job, path };
  }

  private buildMediaJobActionResult(input: {
    account: string;
    action: string;
    kind: "image" | "video";
    job: MediaJobRecord;
    jobPath: string;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: input.account,
      action: input.action,
      message: input.job.message ?? `Loaded the saved Gemini ${input.kind} job.`,
      id: input.job.responseId,
      url: input.job.conversationId ? `https://gemini.google.com/app/${input.job.conversationId}` : undefined,
      data: {
        jobId: input.job.jobId,
        jobPath: input.jobPath,
        status: input.job.status,
        model: readStringMetadata(input.job.metadata, "model") ?? "gemini-3-flash",
        chatId: input.job.conversationId,
        responseId: input.job.responseId,
        candidateId: input.job.providerJobId,
        outputText: readStringMetadata(input.job.metadata, "outputText"),
        outputUrls: input.job.outputUrls,
        outputPaths: input.job.outputPaths,
        thumbnailUrls: readStringArrayMetadata(input.job.metadata, "thumbnailUrls"),
      },
    };
  }
}

export const geminiAdapter = new GeminiAdapter();

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  return typeof metadata?.[key] === "string" ? (metadata[key] as string) : undefined;
}

function readStringArrayMetadata(metadata: Record<string, unknown> | undefined, key: string): string[] | undefined {
  if (!Array.isArray(metadata?.[key])) {
    return undefined;
  }

  const values = (metadata[key] as unknown[]).filter((value): value is string => typeof value === "string" && value.length > 0);
  return values.length > 0 ? values : undefined;
}

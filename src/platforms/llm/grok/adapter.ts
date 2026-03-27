import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { AutoCliError, isAutoCliError } from "../../../errors.js";
import { GrokService } from "./service.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  LoginInput,
  PlatformSession,
} from "../../../types.js";

export class GrokAdapter extends CookieLlmAdapter {
  private readonly service = new GrokService();

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
      });

      await this.persistActiveSession(session, client.jar, result.model);

      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "image",
        message: `Grok generated ${result.outputPaths.length || result.outputUrls.length} image${result.outputPaths.length === 1 || result.outputUrls.length === 1 ? "" : "s"} using ${result.model}.`,
        id: result.responseId,
        url: result.conversationId ? `https://grok.com/c/${result.conversationId}` : undefined,
        data: {
          model: result.model,
          conversationId: result.conversationId,
          responseId: result.responseId,
          outputText: result.outputText,
          followUpSuggestions: result.followUpSuggestions,
          outputPaths: result.outputPaths,
          outputUrls: result.outputUrls,
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
      });

      await this.persistActiveSession(session, client.jar, result.model);

      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "video",
        message:
          result.status === "completed"
            ? `Grok generated a video using ${result.model}.`
            : `Grok accepted the video generation job using ${result.model}, but the final asset URL is still pending.`,
        id: result.responseId,
        url: result.conversationId ? `https://grok.com/c/${result.conversationId}` : undefined,
        data: {
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

  protected async executeText(
    session: PlatformSession,
    input: {
      account?: string;
      prompt: string;
      model?: string;
    },
  ): Promise<AdapterActionResult> {
    const client = await this.createClient(session);

    try {
      const result = await this.service.executeText(client, {
        prompt: input.prompt,
        model: input.model,
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
}

export const grokAdapter = new GrokAdapter();

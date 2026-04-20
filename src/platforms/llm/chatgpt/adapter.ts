import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { MikaCliError } from "../../../errors.js";
import { ChatGptService } from "./service.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  LoginInput,
  PlatformSession,
  SessionStatus,
} from "../../../types.js";

export class ChatGptAdapter extends CookieLlmAdapter {
  private readonly service = new ChatGptService();

  constructor() {
    super({
      platform: "chatgpt",
      defaultModel: "auto",
      textUnsupportedMessage:
        "ChatGPT text prompting is temporarily unavailable.",
      imageUnsupportedMessage:
        "ChatGPT image prompting is temporarily unavailable.",
      videoUnsupportedMessage:
        "ChatGPT video prompting is not wired yet in this CLI because the private media-generation flow is still being mapped.",
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
        backendAccessible: inspection.backendAccessible,
      },
    });

    return this.buildStatusResult({
      account: persisted.account,
      sessionPath: path,
      status: inspection.status,
      user: inspection.user,
    });
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      jar: inspection.jar,
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        backendAccessible: inspection.backendAccessible,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: persisted.account,
      action: "status",
      message: inspection.status.message ?? `ChatGPT session is ${inspection.status.state}.`,
      sessionPath: path,
      user: inspection.user,
      data: {
        status: inspection.status.state,
        connected: inspection.status.state === "active",
        lastValidatedAt: inspection.status.lastValidatedAt,
        backendAccessible: inspection.backendAccessible ?? false,
      },
    };
  }

  async text(input: {
    account?: string;
    prompt: string;
    model?: string;
  }): Promise<AdapterActionResult> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new MikaCliError("INVALID_PROMPT", "Expected a non-empty ChatGPT text prompt.");
    }

    const { session } = await this.loadSession(input.account);
    const client = await this.createClient(session);
    const inspection = await this.service.inspectSession(client);
    const inspectedSession = await this.persistExistingSession(session, {
      jar: client.jar,
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        backendAccessible: inspection.backendAccessible,
      },
    });

    if (inspection.status.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", inspection.status.message ?? "ChatGPT session expired. Re-import cookies.", {
        details: {
          platform: this.platform,
          account: inspectedSession.account,
        },
      });
    }

    const result = await this.service.executeAuthenticatedText(client, {
      prompt,
      model: input.model,
    });
    const status: SessionStatus = {
      state: "active",
      message: "ChatGPT session is active. Browserless authenticated prompting is available.",
      lastValidatedAt: new Date().toISOString(),
    };
    const persisted = await this.persistExistingSession(inspectedSession, {
      jar: client.jar,
      user: inspection.user ?? inspectedSession.user,
      status,
      metadata: {
        ...(inspectedSession.metadata ?? {}),
        backendAccessible: true,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: persisted.account,
      action: "text",
      message: `ChatGPT replied using ${result.model} (${result.mode}).`,
      id: result.messageId,
      url: result.conversationId ? `https://chatgpt.com/c/${result.conversationId}` : undefined,
      data: {
        mode: result.mode,
        model: result.model,
        conversationId: result.conversationId,
        messageId: result.messageId,
        outputText: result.outputText,
      },
    };
  }

  async image(input: {
    account?: string;
    mediaPath: string;
    caption?: string;
    model?: string;
  }): Promise<AdapterActionResult> {
    const result = await this.service.executeImage({
      mediaPath: input.mediaPath,
      caption: input.caption,
      model: input.model,
    });

    return {
      ok: true,
      platform: this.platform,
      account: input.account ?? "anonymous",
      action: "image",
      message: `ChatGPT replied to the uploaded image using ${result.model} (${result.mode}).`,
      id: result.messageId,
      url: result.conversationId ? `https://chatgpt.com/c/${result.conversationId}` : undefined,
      data: {
        mode: result.mode,
        model: result.model,
        conversationId: result.conversationId,
        messageId: result.messageId,
        fileId: result.fileId,
        outputText: result.outputText,
      },
    };
  }

  async video(): Promise<AdapterActionResult> {
    throw new MikaCliError(
      "CHATGPT_VIDEO_UNIMPLEMENTED",
      "ChatGPT video prompting is scaffolded, but the private generation endpoint is not mapped yet in this CLI.",
    );
  }

  protected async executeText(_session: PlatformSession): Promise<AdapterActionResult> {
    throw new MikaCliError("CHATGPT_TEXT_INTERNAL_MISMATCH", "ChatGPT text dispatch should not use the cookie-only adapter path.");
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
        backendAccessible: inspection.backendAccessible,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: persisted.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved ChatGPT session for ${persisted.account}.`
          : `Saved ChatGPT session for ${persisted.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: inspection.user,
      data: {
        status: inspection.status.state,
        backendAccessible: inspection.backendAccessible ?? false,
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
}

export const chatgptAdapter = new ChatGptAdapter();

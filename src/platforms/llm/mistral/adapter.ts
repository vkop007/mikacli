import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { MikaCliError, isMikaCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { MistralService, mapMistralError } from "./service.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession, SessionStatus } from "../../../types.js";

export class MistralAdapter extends CookieLlmAdapter {
  private readonly service = new MistralService();

  constructor() {
    super({
      platform: "mistral",
      defaultModel: "mistral-medium-latest",
      textUnsupportedMessage: "Mistral text prompting is temporarily unavailable.",
      imageUnsupportedMessage:
        "Mistral image prompting is scaffolded, but the private upload flow still needs live validation before this command can run reliably.",
      videoUnsupportedMessage:
        "Mistral video prompting is not implemented in this CLI because the browserless web video flow is not mapped yet.",
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
      throw new MikaCliError("INVALID_PROMPT", "Expected a non-empty Mistral text prompt.");
    }

    const loaded = await this.tryLoadPromptSession(input.account);
    const client = loaded ? await this.createClient(loaded.session) : new SessionHttpClient();
    const result = await this.service.executeText(client, {
      prompt,
      model: input.model?.trim() || "mistral-medium-latest",
    });

    if (loaded) {
      await this.persistSessionAfterText(loaded.session, client, result.mode, result.user, result.model);
    }

    return {
      ok: true,
      platform: this.platform,
      account: loaded?.session.account ?? "anonymous",
      action: "text",
      message: `Mistral replied using ${result.model} (${result.mode}).`,
      id: result.assistantMessageId,
      url: result.url,
      user: result.user,
      data: {
        mode: result.mode,
        model: result.model,
        chatId: result.chatId,
        userMessageId: result.userMessageId,
        assistantMessageId: result.assistantMessageId,
        outputText: result.outputText,
        references: result.references,
      },
    };
  }

  protected async executeText(_session: PlatformSession): Promise<AdapterActionResult> {
    throw new MikaCliError("MISTRAL_TEXT_INTERNAL_MISMATCH", "Mistral text dispatch should use the dedicated adapter flow.");
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);

    await this.persistExistingSession(session, {
      jar: inspection.jar,
      user: inspection.user,
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
          ? `Saved Mistral session for ${session.account}.`
          : `Saved Mistral session for ${session.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
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

  private async tryLoadPromptSession(account?: string): Promise<{ session: PlatformSession; path: string } | null> {
    try {
      return await this.loadSession(account);
    } catch (error) {
      if (!account && isMikaCliError(error) && error.code === "SESSION_NOT_FOUND") {
        return null;
      }

      throw error;
    }
  }

  private async persistSessionAfterText(
    session: PlatformSession,
    client: SessionHttpClient,
    mode: "anonymous-web" | "authenticated-web",
    user: PlatformSession["user"],
    model: string,
  ): Promise<void> {
    const status: SessionStatus =
      mode === "authenticated-web"
        ? {
            state: "active",
            message: "Mistral session is active.",
            lastValidatedAt: new Date().toISOString(),
          }
        : {
            state: "expired",
            message: "Saved Mistral auth cookies were not active, so the prompt ran anonymously.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "SESSION_EXPIRED",
          };

    await this.persistExistingSession(session, {
      jar: client.jar,
      user: user ?? session.user,
      status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: model,
      },
    });
  }
}

export const mistralAdapter = new MistralAdapter();

export function mapMistralAdapterError(error: unknown): MikaCliError {
  return mapMistralError(error, "Failed to complete the Mistral prompt.");
}

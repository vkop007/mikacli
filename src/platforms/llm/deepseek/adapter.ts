import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { DeepSeekWebClient, mapDeepSeekError, normalizeDeepSeekAuthToken } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession } from "../../../types.js";

export class DeepSeekAdapter extends CookieLlmAdapter {
  constructor() {
    super({
      platform: "deepseek",
      defaultModel: "deepseek-chat",
      textUnsupportedMessage: "DeepSeek text prompting is temporarily unavailable.",
      imageUnsupportedMessage: "DeepSeek image prompting is not implemented in this CLI yet.",
      videoUnsupportedMessage: "DeepSeek video prompting is not implemented in this CLI yet.",
    });
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const account = input.account?.trim() || "default";
    const token = normalizeOptionalDeepSeekToken(input.token);
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      status: {
        state: "unknown",
        message: "DeepSeek session imported. Verifying browser token...",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        defaultModel: "deepseek-chat",
        ...(token ? { deepseekUserToken: token } : {}),
      },
      jar: imported.jar,
    });

    return this.refreshSavedSession(account, sessionPath);
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel ?? session.metadata?.defaultModel ?? "deepseek-chat",
      },
    });

    return this.buildStatusResult({
      account: persisted.account,
      sessionPath: path,
      status: inspection.status,
      user: inspection.user,
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

    try {
      const result = await new DeepSeekWebClient(client, readDeepSeekToken(session)).executeText({
        prompt: input.prompt,
        model: input.model,
      });

      await this.persistExistingSession(session, {
        user: session.user,
        status: {
          state: "active",
          message: "DeepSeek session is active.",
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
        message: `DeepSeek replied using ${result.model}.`,
        id: result.messageId,
        url: `https://chat.deepseek.com/a/chat/s/${result.chatSessionId}`,
        data: {
          model: result.model,
          chatSessionId: result.chatSessionId,
          messageId: result.messageId,
          outputText: result.outputText,
          thinkingText: result.thinkingText,
        },
      };
    } catch (error) {
      throw mapDeepSeekError(error, "Failed to complete the DeepSeek prompt.");
    }
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);

    await this.persistExistingSession(session, {
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel ?? session.metadata?.defaultModel ?? "deepseek-chat",
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved DeepSeek session for ${session.account}.`
          : `Saved DeepSeek session for ${session.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: inspection.user,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    return new DeepSeekWebClient(client, readDeepSeekToken(session)).inspectSession();
  }
}

export const deepSeekAdapter = new DeepSeekAdapter();

function readDeepSeekToken(session: PlatformSession): string | undefined {
  const token = session.metadata?.deepseekUserToken;
  return typeof token === "string" && token.trim().length > 0 ? token : undefined;
}

function normalizeOptionalDeepSeekToken(token?: string): string | undefined {
  if (typeof token !== "string" || token.trim().length === 0) {
    return undefined;
  }

  return normalizeDeepSeekAuthToken(token);
}

import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { PerplexityService } from "./service.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession } from "../../../types.js";

export class PerplexityAdapter extends CookieLlmAdapter {
  private readonly service = new PerplexityService();

  constructor() {
    super({
      platform: "perplexity",
      defaultModel: "turbo",
      textUnsupportedMessage: "Perplexity text prompting is temporarily unavailable.",
      imageUnsupportedMessage:
        "Perplexity image prompting is scaffolded, but the private upload flow still needs live validation before this command can run reliably.",
      videoUnsupportedMessage:
        "Perplexity video prompting is not implemented in this CLI because the browserless web video flow is not mapped yet.",
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

    await this.persistExistingSession(session, {
      jar: client.jar,
      user: result.user ?? session.user,
      status: {
        state: "active",
        message: "Perplexity session is active. Browserless prompting is available.",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: result.model,
        ...(result.subscriptionTier ? { subscriptionTier: result.subscriptionTier } : {}),
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "text",
      message: `Perplexity replied using ${result.model}.`,
      id: result.queryId,
      url: result.url,
      user: result.user ?? session.user,
      data: {
        model: result.model,
        outputText: result.outputText,
        mode: result.mode,
        searchFocus: result.searchFocus,
        threadUrlSlug: result.threadUrlSlug,
        backendUuid: result.backendUuid,
        queryId: result.queryId,
        answerModes: result.answerModes,
        webResults: result.webResults,
      },
    };
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
        ...(inspection.subscriptionTier ? { subscriptionTier: inspection.subscriptionTier } : {}),
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved Perplexity session for ${session.account}.`
          : `Saved Perplexity session for ${session.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: inspection.user,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    const inspection = await this.service.inspectSession(client);
    return {
      ...inspection,
      jar: client.jar,
    };
  }
}

export const perplexityAdapter = new PerplexityAdapter();

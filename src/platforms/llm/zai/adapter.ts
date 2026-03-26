import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { ZaiService } from "./service.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession } from "../../../types.js";

export class ZaiAdapter extends CookieLlmAdapter {
  private readonly service = new ZaiService();

  constructor() {
    super({
      platform: "zai",
      defaultModel: "glm-5",
      textUnsupportedMessage:
        "Z.ai text prompting is temporarily unavailable.",
      imageUnsupportedMessage:
        "Z.ai image prompting is scaffolded, but the private upload flow still needs live validation.",
      videoUnsupportedMessage:
        "Z.ai video prompting is scaffolded, but the private generation endpoint is not mapped yet in this CLI.",
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
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(inspection.defaultModel ? { defaultModel: inspection.defaultModel } : {}),
        ...(inspection.frontendVersion ? { frontendVersion: inspection.frontendVersion } : {}),
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
      user: result.user,
      status: {
        state: "active",
        message: "Z.ai session is active.",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: result.model,
        frontendVersion: result.frontendVersion,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "text",
      message: `Z.ai replied using ${result.model}.`,
      id: result.chatId,
      url: result.url,
      user: result.user,
      data: {
        model: result.model,
        outputText: result.outputText,
        usage: result.usage,
      },
    };
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      user: inspection.user,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(inspection.defaultModel ? { defaultModel: inspection.defaultModel } : {}),
        ...(inspection.frontendVersion ? { frontendVersion: inspection.frontendVersion } : {}),
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: persisted.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved Z.ai session for ${persisted.account}.`
          : `Saved Z.ai session for ${persisted.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: inspection.user,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    return this.service.inspectSession(client);
  }
}

export const zaiAdapter = new ZaiAdapter();

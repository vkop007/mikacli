import { constants } from "node:fs";
import { access } from "node:fs/promises";

import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";
import { MikaCliError } from "../../../errors.js";
import { getPlatformAuthCookieNames, getPlatformHomeUrl } from "../../config.js";
import { buildCookieLlmSessionStatus } from "./helpers.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  Platform,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  TextPostInput,
} from "../../../types.js";

export interface CookieLlmTextInput {
  account?: string;
  prompt: string;
  model?: string;
}

export interface CookieLlmImageInput {
  account?: string;
  mediaPath: string;
  caption?: string;
  model?: string;
}

export interface CookieLlmVideoInput {
  account?: string;
  prompt: string;
  model?: string;
}

export interface CookieLlmProviderSpec {
  platform: Platform;
  defaultModel?: string;
  textUnsupportedMessage: string;
  imageUnsupportedMessage: string;
  videoUnsupportedMessage: string;
}

export class CookieLlmAdapter extends BasePlatformAdapter {
  readonly platform: Platform;

  constructor(protected readonly provider: CookieLlmProviderSpec) {
    super();
    this.platform = provider.platform;
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const status = await this.inspectImportedCookies(imported.jar);
    const account = input.account ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      status,
      metadata: {
        defaultModel: this.provider.defaultModel,
      },
      jar: imported.jar,
    });

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message:
        status.state === "active"
          ? `Saved ${this.displayName} session for ${account}.`
          : `Saved ${this.displayName} session for ${account}, but ${status.message?.toLowerCase() ?? "live validation is still pending."}`,
      sessionPath,
      data: {
        status: status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const nextStatus = await this.inspectSession(session);
    await this.persistExistingSession(session, { status: nextStatus });
    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: nextStatus,
      user: session.user,
    });
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: status.message ?? `${this.displayName} session is ${status.status}.`,
      sessionPath: status.sessionPath,
      user: status.user,
      data: {
        status: status.status,
        connected: status.connected,
        lastValidatedAt: status.lastValidatedAt,
      },
    };
  }

  async text(input: CookieLlmTextInput): Promise<AdapterActionResult> {
    const session = await this.ensureUsableSession(input.account);
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new MikaCliError("INVALID_PROMPT", `Expected a non-empty ${this.displayName} text prompt.`);
    }

    return this.executeText(session, {
      ...input,
      prompt,
      model: input.model?.trim() || this.provider.defaultModel,
    });
  }

  async image(input: CookieLlmImageInput): Promise<AdapterActionResult> {
    const session = await this.ensureUsableSession(input.account);
    await access(input.mediaPath, constants.R_OK).catch(() => {
      throw new MikaCliError("MEDIA_NOT_FOUND", `Could not read media file: ${input.mediaPath}`, {
        details: { mediaPath: input.mediaPath },
      });
    });

    return this.executeImage(session, {
      ...input,
      model: input.model?.trim() || this.provider.defaultModel,
    });
  }

  async video(input: CookieLlmVideoInput): Promise<AdapterActionResult> {
    const session = await this.ensureUsableSession(input.account);
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new MikaCliError("INVALID_PROMPT", `Expected a non-empty ${this.displayName} video prompt.`);
    }

    return this.executeVideo(session, {
      ...input,
      prompt,
      model: input.model?.trim() || this.provider.defaultModel,
    });
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    return this.image({
      account: input.account,
      mediaPath: input.mediaPath,
      caption: input.caption,
    });
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    return this.text({
      account: input.account,
      prompt: input.text,
    });
  }

  async like(_input: LikeInput): Promise<AdapterActionResult> {
    throw new MikaCliError("UNSUPPORTED_ACTION", `${this.displayName} does not expose like-style commands in this CLI.`);
  }

  async comment(_input: CommentInput): Promise<AdapterActionResult> {
    throw new MikaCliError("UNSUPPORTED_ACTION", `${this.displayName} does not expose comment-style commands in this CLI.`);
  }

  protected async executeText(_session: PlatformSession, input: CookieLlmTextInput): Promise<AdapterActionResult> {
    throw new MikaCliError(`${this.platform.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_TEXT_UNIMPLEMENTED`, this.provider.textUnsupportedMessage, {
      details: {
        platform: this.platform,
        model: input.model,
      },
    });
  }

  protected async executeImage(_session: PlatformSession, input: CookieLlmImageInput): Promise<AdapterActionResult> {
    throw new MikaCliError(`${this.platform.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_IMAGE_UNIMPLEMENTED`, this.provider.imageUnsupportedMessage, {
      details: {
        platform: this.platform,
        mediaPath: input.mediaPath,
        model: input.model,
      },
    });
  }

  protected async executeVideo(_session: PlatformSession, input: CookieLlmVideoInput): Promise<AdapterActionResult> {
    throw new MikaCliError(`${this.platform.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_VIDEO_UNIMPLEMENTED`, this.provider.videoUnsupportedMessage, {
      details: {
        platform: this.platform,
        model: input.model,
      },
    });
  }

  private async ensureUsableSession(account?: string): Promise<PlatformSession> {
    const { session } = await this.loadSession(account);
    const nextStatus = await this.inspectSession(session);
    const persisted = await this.persistExistingSession(session, { status: nextStatus });

    if (nextStatus.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", nextStatus.message ?? `${this.displayName} session has expired.`, {
        details: {
          platform: this.platform,
          account: persisted.account,
        },
      });
    }

    return persisted;
  }

  private async inspectSession(session: PlatformSession): Promise<SessionStatus> {
    const jar = await this.cookieManager.createJar(session);
    return this.inspectImportedCookies(jar);
  }

  private async inspectImportedCookies(jar: Awaited<ReturnType<(typeof this.cookieManager)["createJar"]>>): Promise<SessionStatus> {
    const cookies = await jar.getCookies(getPlatformHomeUrl(this.platform));
    return buildCookieLlmSessionStatus({
      displayName: this.displayName,
      cookieNames: cookies.map((cookie) => cookie.key),
      authCookieNames: getPlatformAuthCookieNames(this.platform),
    });
  }
}

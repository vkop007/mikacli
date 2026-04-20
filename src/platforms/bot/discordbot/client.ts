import { MikaCliError } from "../../../errors.js";
import { readUploadFile } from "../../../utils/file-source.js";
import { createUploadFile } from "../../../utils/upload-pipeline.js";

import type { DiscordChannel, DiscordCurrentUser, DiscordGuild, DiscordMessage } from "./types.js";
import { DISCORD_API_BASE_URL } from "./helpers.js";

type DiscordErrorPayload = {
  message?: string;
  code?: number;
  retry_after?: number;
};

export interface DiscordApiClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class DiscordApiClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: DiscordApiClientOptions) {
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? DISCORD_API_BASE_URL;
  }

  async getCurrentUser(): Promise<DiscordCurrentUser> {
    return this.request<DiscordCurrentUser>("GET", "/users/@me");
  }

  async getCurrentUserGuilds(): Promise<DiscordGuild[]> {
    return this.request<DiscordGuild[]>("GET", "/users/@me/guilds");
  }

  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>("GET", `/guilds/${encodeURIComponent(guildId)}/channels`);
  }

  async getChannel(channelId: string): Promise<DiscordChannel> {
    return this.request<DiscordChannel>("GET", `/channels/${encodeURIComponent(channelId)}`);
  }

  async getChannelMessages(
    channelId: string,
    input: {
      limit?: number;
      before?: string;
      after?: string;
      around?: string;
    } = {},
  ): Promise<DiscordMessage[]> {
    const params = new URLSearchParams();
    if (typeof input.limit === "number" && Number.isFinite(input.limit)) {
      params.set("limit", String(Math.min(Math.max(Math.floor(input.limit), 1), 100)));
    }
    if (input.before) {
      params.set("before", input.before);
    }
    if (input.after) {
      params.set("after", input.after);
    }
    if (input.around) {
      params.set("around", input.around);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.request<DiscordMessage[]>("GET", `/channels/${encodeURIComponent(channelId)}/messages${suffix}`);
  }

  async createMessage(
    channelId: string,
    content: string,
    input: {
      replyToMessageId?: string;
    } = {},
  ): Promise<DiscordMessage> {
    return this.request<DiscordMessage>("POST", `/channels/${encodeURIComponent(channelId)}/messages`, {
      json: {
        content,
        ...(input.replyToMessageId
          ? {
              message_reference: {
                message_id: input.replyToMessageId,
              },
            }
          : {}),
      },
    });
  }

  async createMessageWithFile(
    channelId: string,
    input: {
      filePath: string;
      content?: string;
      replyToMessageId?: string;
    },
  ): Promise<DiscordMessage> {
    const file = await readUploadFile(input.filePath);
    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        content: input.content?.trim() || undefined,
        ...(input.replyToMessageId
          ? {
              message_reference: {
                message_id: input.replyToMessageId,
              },
        }
          : {}),
      }),
    );
    form.append("files[0]", createUploadFile(file));

    return this.request<DiscordMessage>("POST", `/channels/${encodeURIComponent(channelId)}/messages`, {
      body: form,
    });
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessage> {
    return this.request<DiscordMessage>("PATCH", `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
      json: {
        content,
      },
    });
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.request<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`);
  }

  private async request<T>(
    method: string,
    path: string,
    input: {
      json?: Record<string, unknown>;
      body?: BodyInit;
      headers?: HeadersInit;
    } = {},
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        const headers = new Headers(input.headers);
        headers.set("Authorization", `Bot ${this.token}`);
        headers.set("Accept", "application/json");
        if (input.json) {
          headers.set("Content-Type", "application/json");
        }

        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: input.json ? JSON.stringify(input.json) : input.body,
        });
      } catch (error) {
        lastError = error;
        break;
      }

      if (response.status === 429) {
        const retryAfter = await this.readRetryAfter(response);
        if (attempt === 0 && retryAfter > 0) {
          await this.sleep(retryAfter);
          continue;
        }

        throw new MikaCliError("DISCORD_RATE_LIMITED", `Discord rate limited ${method} ${path}.`, {
          details: {
            method,
            path,
            retryAfterMs: retryAfter,
          },
        });
      }

      const text = await response.text();
      const parsed = this.tryParseJson(text);

      if (!response.ok) {
        const message = typeof parsed === "object" && parsed && "message" in parsed && typeof parsed.message === "string"
          ? parsed.message
          : `Discord API returned HTTP ${response.status} for ${method} ${path}.`;

        throw new MikaCliError(this.mapStatusCode(response.status), message, {
          details: {
            method,
            path,
            status: response.status,
            code: typeof parsed === "object" && parsed && "code" in parsed && typeof parsed.code === "number" ? parsed.code : undefined,
          },
        });
      }

      if (response.status === 204 || text.trim().length === 0) {
        return undefined as T;
      }

      if (parsed === null) {
        throw new MikaCliError("DISCORD_INVALID_RESPONSE", `Discord returned a non-JSON response for ${method} ${path}.`, {
          details: {
            method,
            path,
            status: response.status,
            body: text.slice(0, 2000),
          },
        });
      }

      return parsed as T;
    }

    throw new MikaCliError("DISCORD_API_UNAVAILABLE", `Unable to reach Discord API for ${method} ${path}.`, {
      cause: lastError instanceof Error ? lastError : undefined,
      details: {
        method,
        path,
      },
    });
  }

  private async readRetryAfter(response: Response): Promise<number> {
    const header = response.headers.get("retry-after");
    if (header) {
      const parsed = Number(header);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return Math.ceil(parsed * 1000);
      }
    }

    try {
      const parsed = (await response.clone().json()) as DiscordErrorPayload;
      if (typeof parsed.retry_after === "number" && parsed.retry_after > 0) {
        return Math.ceil(parsed.retry_after * 1000);
      }
    } catch {
      // ignore and fall back to a short retry delay
    }

    return 1000;
  }

  private tryParseJson(text: string): unknown | null {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }

  private mapStatusCode(status: number): string {
    switch (status) {
      case 401:
        return "DISCORD_UNAUTHORIZED";
      case 403:
        return "DISCORD_FORBIDDEN";
      case 404:
        return "DISCORD_NOT_FOUND";
      case 429:
        return "DISCORD_RATE_LIMITED";
      default:
        return "DISCORD_HTTP_ERROR";
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

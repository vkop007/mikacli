import { AutoCliError } from "../../errors.js";

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
};

export interface SlackbotApiClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class SlackbotApiClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: SlackbotApiClientOptions) {
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://slack.com/api";
  }

  async authTest(): Promise<SlackAuthTestResponse> {
    return await this.request<SlackAuthTestResponse>("auth.test");
  }

  async usersInfo(userId: string): Promise<SlackUsersInfoResponse> {
    return await this.request<SlackUsersInfoResponse>("users.info", {
      user: userId,
    });
  }

  async conversationsList(input: { cursor?: string; limit?: number } = {}): Promise<SlackConversationsListResponse> {
    return await this.request<SlackConversationsListResponse>("conversations.list", {
      exclude_archived: true,
      limit: input.limit ?? 200,
      types: "public_channel,private_channel",
      cursor: input.cursor,
    });
  }

  async conversationsHistory(input: {
    channel: string;
    cursor?: string;
    limit?: number;
    latest?: string;
    oldest?: string;
    inclusive?: boolean;
  }): Promise<SlackConversationHistoryResponse> {
    return await this.request<SlackConversationHistoryResponse>("conversations.history", {
      channel: input.channel,
      cursor: input.cursor,
      limit: input.limit ?? 100,
      latest: input.latest,
      oldest: input.oldest,
      inclusive: input.inclusive,
    });
  }

  async chatPostMessage(input: { channel: string; text: string; thread_ts?: string }): Promise<SlackChatMessageResponse> {
    return await this.request<SlackChatMessageResponse>("chat.postMessage", input);
  }

  async chatUpdate(input: { channel: string; ts: string; text: string }): Promise<SlackChatMessageResponse> {
    return await this.request<SlackChatMessageResponse>("chat.update", input);
  }

  async chatDelete(input: { channel: string; ts: string }): Promise<SlackChatDeleteResponse> {
    return await this.request<SlackChatDeleteResponse>("chat.delete", input);
  }

  async chatGetPermalink(input: { channel: string; message_ts: string }): Promise<SlackPermalinkResponse> {
    return await this.request<SlackPermalinkResponse>("chat.getPermalink", input);
  }

  async filesGetUploadURLExternal(input: {
    filename: string;
    length: number;
    alt_txt?: string;
  }): Promise<SlackGetUploadUrlExternalResponse> {
    return await this.request<SlackGetUploadUrlExternalResponse>("files.getUploadURLExternal", {
      filename: input.filename,
      length: input.length,
      alt_txt: input.alt_txt,
    });
  }

  async filesCompleteUploadExternal(input: {
    files: Array<{ id: string; title?: string }>;
    channel_id?: string;
    initial_comment?: string;
    thread_ts?: string;
  }): Promise<SlackCompleteUploadExternalResponse> {
    return await this.request<SlackCompleteUploadExternalResponse>("files.completeUploadExternal", {
      files: JSON.stringify(input.files),
      channel_id: input.channel_id,
      initial_comment: input.initial_comment,
      thread_ts: input.thread_ts,
    });
  }

  async uploadExternalFile(uploadUrl: string, input: { bytes: Uint8Array; mimeType: string }): Promise<void> {
    const bytes = new Uint8Array(input.bytes);
    let response: Response;
    try {
      response = await this.fetchImpl(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": input.mimeType,
          "Content-Length": String(bytes.byteLength),
        },
        body: new Blob([bytes], { type: input.mimeType }),
      });
    } catch (error) {
      throw new AutoCliError("SLACK_UPLOAD_UNAVAILABLE", "Unable to reach Slack's external upload URL.", {
        cause: error,
        details: {
          uploadUrl,
        },
      });
    }

    if (!response.ok) {
      throw new AutoCliError("SLACK_UPLOAD_FAILED", "Slack external file upload failed.", {
        details: {
          uploadUrl,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }
  }

  async conversationsAll(): Promise<SlackConversationSummary[]> {
    const channels: SlackConversationSummary[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.conversationsList({ cursor });
      channels.push(...(response.channels ?? []));
      cursor = response.response_metadata?.next_cursor?.trim() || undefined;
    } while (cursor);

    return channels;
  }

  async resolveChannelId(reference: string): Promise<string> {
    const normalized = normalizeChannelReference(reference);

    if (looksLikeSlackChannelId(normalized)) {
      return normalized;
    }

    const channels = await this.conversationsAll();
    const found = channels.find((channel) => channel.id === normalized || channel.name === normalized);
    if (!found) {
      throw new AutoCliError("SLACK_CHANNEL_NOT_FOUND", `Could not find a Slack channel named "${reference}".`, {
        details: { channel: reference },
      });
    }

    return found.id;
  }

  private async request<T extends SlackApiResponse>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const body = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      body.set(key, String(value));
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        body,
      });
    } catch (error) {
      throw new AutoCliError("SLACK_API_UNAVAILABLE", `Unable to reach Slack API method "${method}".`, {
        cause: error,
        details: { method },
      });
    }

    const requestId = response.headers.get("x-slack-req-id") ?? undefined;

    if (response.status === 429) {
      throw new AutoCliError("SLACK_RATE_LIMITED", `Slack rate limited method "${method}".`, {
        details: {
          method,
          requestId,
          retryAfterSeconds: response.headers.get("retry-after") ?? undefined,
        },
      });
    }

    const text = await response.text();
    let payload: SlackApiResponse;

    try {
      payload = JSON.parse(text) as SlackApiResponse;
    } catch (error) {
      throw new AutoCliError("INVALID_SLACK_RESPONSE", "Slack returned a non-JSON response.", {
        cause: error,
        details: {
          method,
          requestId,
          status: response.status,
          body: text.slice(0, 2000),
        },
      });
    }

    if (!response.ok) {
      throw new AutoCliError("SLACK_HTTP_ERROR", `Slack API returned HTTP ${response.status} for "${method}".`, {
        details: {
          method,
          requestId,
          status: response.status,
        },
      });
    }

    if (!payload.ok) {
      throw new AutoCliError("SLACK_API_ERROR", `Slack API method "${method}" failed.`, {
        details: {
          method,
          requestId,
          error: payload.error,
        },
      });
    }

    return payload as T;
  }
}

export interface SlackAuthTestResponse extends SlackApiResponse {
  ok: true;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
  bot_name?: string;
  bot_user_id?: string;
}

export interface SlackUsersInfoResponse extends SlackApiResponse {
  ok: true;
  user: {
    id: string;
    name?: string;
    real_name?: string;
    is_bot?: boolean;
    profile?: {
      display_name?: string;
      real_name?: string;
    };
  };
}

export interface SlackConversationsListResponse extends SlackApiResponse {
  ok: true;
  channels: SlackConversationSummary[];
}

export interface SlackConversationHistoryResponse extends SlackApiResponse {
  ok: true;
  messages: SlackHistoryMessage[];
  has_more?: boolean;
}

export interface SlackConversationSummary {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  num_members?: number;
  topic?: {
    value?: string;
  };
  purpose?: {
    value?: string;
  };
}

export interface SlackChatMessageResponse extends SlackApiResponse {
  ok: true;
  channel: string;
  ts: string;
  message?: {
    text?: string;
    user?: string;
  };
}

export interface SlackChatDeleteResponse extends SlackApiResponse {
  ok: true;
  channel: string;
  ts: string;
}

export interface SlackPermalinkResponse extends SlackApiResponse {
  ok: true;
  permalink: string;
}

export interface SlackGetUploadUrlExternalResponse extends SlackApiResponse {
  ok: true;
  upload_url: string;
  file_id: string;
}

export interface SlackCompleteUploadExternalResponse extends SlackApiResponse {
  ok: true;
  files?: Array<{
    id: string;
    title?: string;
    permalink?: string;
  }>;
}

export interface SlackHistoryMessage {
  ts: string;
  text?: string;
  user?: string;
  bot_id?: string;
  thread_ts?: string;
  reply_count?: number;
  files?: Array<{
    id?: string;
    name?: string;
    mimetype?: string;
    url_private?: string;
  }>;
}

export function normalizeChannelReference(reference: string): string {
  const trimmed = reference.trim();
  const mentionMatch = trimmed.match(/^<#([A-Z0-9]+)(?:\|[^>]+)?>$/iu);
  if (mentionMatch?.[1]) {
    return mentionMatch[1];
  }

  return trimmed.replace(/^#/u, "");
}

export function looksLikeSlackChannelId(reference: string): boolean {
  return /^[CGD][A-Z0-9]+$/u.test(reference);
}

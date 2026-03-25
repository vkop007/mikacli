import type { SessionUser } from "../../../types.js";
import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { readUploadFile } from "../../../utils/file-source.js";

import { SlackbotApiClient } from "./api.js";

import type { BotTokenConnectionAuth, ConnectionRecord } from "../../../core/auth/auth-types.js";
import type {
  SlackbotActionResult,
  SlackbotAuthSummary,
  SlackbotChannelsResult,
  SlackbotChannelSummary,
  SlackbotHistoryResult,
} from "./types.js";

export interface SlackbotClientOptions {
  fetchImpl?: typeof fetch;
  connectionStore?: Pick<ConnectionStore, "saveBotTokenConnection" | "loadBotTokenConnection">;
}

export class SlackbotClient {
  private readonly connectionStore: Pick<ConnectionStore, "saveBotTokenConnection" | "loadBotTokenConnection">;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SlackbotClientOptions = {}) {
    this.connectionStore = options.connectionStore ?? new ConnectionStore();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async login(input: { token: string; account?: string }): Promise<SlackbotActionResult> {
    const auth = await this.inspectToken(input.token);
    const accountName = input.account ?? this.defaultAccountName(auth);
    const path = await this.connectionStore.saveBotTokenConnection({
      platform: "slackbot",
      account: accountName,
      provider: "slack",
      token: input.token,
      user: this.toSessionUser(auth),
      status: {
        state: "active",
        message: this.describeAuth(auth, "Validated"),
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        auth,
      },
    });

    return this.actionResult({
      account: accountName,
      action: "login",
      message: this.describeAuth(auth, "Saved"),
      sessionPath: path,
      user: this.toSessionUser(auth),
      data: {
        auth,
      },
    });
  }

  async authTest(input: { account?: string }): Promise<SlackbotActionResult> {
    const { account, path, auth: tokenAuth, connection } = await this.loadConnection(input.account);
    const auth = await this.inspectToken(tokenAuth.token);
    await this.connectionStore.saveBotTokenConnection({
      platform: "slackbot",
      account,
      provider: "slack",
      token: tokenAuth.token,
      user: this.toSessionUser(auth),
      status: {
        state: "active",
        message: this.describeAuth(auth, "Authenticated"),
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        auth,
        previousStatus: connection.status,
      },
    });

    return this.actionResult({
      account,
      action: "auth-test",
      message: this.describeAuth(auth, "Authenticated"),
      sessionPath: path,
      user: this.toSessionUser(auth),
      data: {
        auth,
      },
    });
  }

  async listChannels(input: { account?: string }): Promise<SlackbotChannelsResult> {
    const { account, path, auth: tokenAuth } = await this.loadConnection(input.account);
    const api = new SlackbotApiClient({ token: tokenAuth.token, fetchImpl: this.fetchImpl });
    const channels = await api.conversationsAll();
    const simplified = channels.map((channel) => this.toChannelSummary(channel)).sort((left, right) => left.name.localeCompare(right.name));

    return {
      ok: true,
      platform: "slackbot",
      account,
      action: "channels",
      message: `Found ${simplified.length} Slack channels.`,
      sessionPath: path,
      channels: simplified,
    };
  }

  async history(input: {
    account?: string;
    channel: string;
    limit?: number;
    cursor?: string;
    latest?: string;
    oldest?: string;
  }): Promise<SlackbotHistoryResult> {
    const { account, path, auth: tokenAuth } = await this.loadConnection(input.account);
    const api = new SlackbotApiClient({ token: tokenAuth.token, fetchImpl: this.fetchImpl });
    const channel = await api.resolveChannelId(input.channel);
    const response = await api.conversationsHistory({
      channel,
      cursor: input.cursor,
      limit: input.limit,
      latest: input.latest,
      oldest: input.oldest,
    });

    return {
      ok: true,
      platform: "slackbot",
      account,
      action: "history",
      message: `Loaded ${response.messages.length} Slack message${response.messages.length === 1 ? "" : "s"} from ${input.channel.trim()}.`,
      sessionPath: path,
      channel,
      messages: response.messages.map((message) => ({
        ts: message.ts,
        user: message.user ?? message.bot_id,
        text: message.text,
        threadTs: message.thread_ts,
        replyCount: message.reply_count,
        files: message.files?.map((file) => ({
          id: file.id,
          name: file.name,
          mimetype: file.mimetype,
          urlPrivate: file.url_private,
        })),
      })),
      nextCursor: response.response_metadata?.next_cursor?.trim() || undefined,
    };
  }

  async sendMessage(input: { account?: string; channel: string; text: string; threadTs?: string }): Promise<SlackbotActionResult> {
    const { account, path, auth: tokenAuth } = await this.loadConnection(input.account);
    const api = new SlackbotApiClient({ token: tokenAuth.token, fetchImpl: this.fetchImpl });
    const channel = await api.resolveChannelId(input.channel);
    const posted = await api.chatPostMessage({
      channel,
      text: input.text,
      thread_ts: input.threadTs,
    });
    const permalink = await this.tryGetPermalink(api, channel, posted.ts);

    return this.actionResult({
      account,
      action: "send",
      message: `Sent a message to ${input.channel.trim()}.`,
      id: posted.ts,
      url: permalink,
      sessionPath: path,
      data: {
        channel,
        ts: posted.ts,
      },
    });
  }

  async sendFile(input: {
    account?: string;
    channel: string;
    filePath: string;
    title?: string;
    comment?: string;
    threadTs?: string;
  }): Promise<SlackbotActionResult> {
    const { account, path, auth: tokenAuth } = await this.loadConnection(input.account);
    const api = new SlackbotApiClient({ token: tokenAuth.token, fetchImpl: this.fetchImpl });
    const channel = await api.resolveChannelId(input.channel);
    const file = await readUploadFile(input.filePath);
    const upload = await api.filesGetUploadURLExternal({
      filename: file.filename,
      length: file.size,
    });

    await api.uploadExternalFile(upload.upload_url, {
      bytes: file.bytes,
      mimeType: file.mimeType,
    });

    const completed = await api.filesCompleteUploadExternal({
      files: [
        {
          id: upload.file_id,
          title: input.title ?? file.filename,
        },
      ],
      channel_id: channel,
      initial_comment: input.comment,
      thread_ts: input.threadTs,
    });

    const uploadedFile = completed.files?.[0];

    return this.actionResult({
      account,
      action: "send-file",
      message: `Uploaded a file to ${input.channel.trim()}.`,
      id: upload.file_id,
      url: uploadedFile?.permalink,
      sessionPath: path,
      data: {
        channel,
        fileId: upload.file_id,
        filename: file.filename,
        title: uploadedFile?.title ?? input.title ?? file.filename,
      },
    });
  }

  async editMessage(input: { account?: string; channel: string; ts: string; text: string }): Promise<SlackbotActionResult> {
    const { account, path, auth: tokenAuth } = await this.loadConnection(input.account);
    const api = new SlackbotApiClient({ token: tokenAuth.token, fetchImpl: this.fetchImpl });
    const channel = await api.resolveChannelId(input.channel);
    const updated = await api.chatUpdate({
      channel,
      ts: input.ts,
      text: input.text,
    });
    const permalink = await this.tryGetPermalink(api, channel, updated.ts);

    return this.actionResult({
      account,
      action: "edit",
      message: `Edited a message in ${input.channel.trim()}.`,
      id: updated.ts,
      url: permalink,
      sessionPath: path,
      data: {
        channel,
        ts: updated.ts,
      },
    });
  }

  async deleteMessage(input: { account?: string; channel: string; ts: string }): Promise<SlackbotActionResult> {
    const { account, path, auth: tokenAuth } = await this.loadConnection(input.account);
    const api = new SlackbotApiClient({ token: tokenAuth.token, fetchImpl: this.fetchImpl });
    const channel = await api.resolveChannelId(input.channel);
    await api.chatDelete({
      channel,
      ts: input.ts,
    });
    const permalink = await this.tryGetPermalink(api, channel, input.ts);

    return this.actionResult({
      account,
      action: "delete",
      message: `Deleted a message from ${input.channel.trim()}.`,
      id: input.ts,
      url: permalink,
      sessionPath: path,
      data: {
        channel,
        ts: input.ts,
      },
    });
  }

  private async loadConnection(account?: string): Promise<{
    account: string;
    path: string;
    auth: BotTokenConnectionAuth;
    connection: ConnectionRecord;
  }> {
    const { connection, path, auth } = await this.connectionStore.loadBotTokenConnection("slackbot", account);
    return {
      account: connection.account,
      path,
      auth,
      connection,
    };
  }

  private async inspectToken(token: string): Promise<SlackbotAuthSummary> {
    const api = new SlackbotApiClient({ token, fetchImpl: this.fetchImpl });
    const auth = await api.authTest();
    const summary: SlackbotAuthSummary = {
      ok: true,
      team: auth.team,
      teamId: auth.team_id,
      url: auth.url,
      userId: auth.user_id ?? auth.user,
      botUserId: auth.bot_user_id,
      botName: auth.bot_name,
    };

    if (auth.user_id) {
      try {
        const profile = await api.usersInfo(auth.user_id);
        const displayName = profile.user.profile?.display_name?.trim() || profile.user.profile?.real_name?.trim() || profile.user.real_name?.trim() || profile.user.name?.trim();
        if (displayName) {
          summary.userName = displayName;
        }
      } catch {
        // Some bot tokens can authenticate but cannot resolve a user profile.
      }
    }

    if (!summary.userName) {
      summary.userName = auth.user ?? auth.bot_name ?? auth.bot_user_id ?? auth.user_id;
    }

    return summary;
  }

  private async tryGetPermalink(api: SlackbotApiClient, channel: string, ts: string): Promise<string | undefined> {
    try {
      const result = await api.chatGetPermalink({
        channel,
        message_ts: ts,
      });
      return result.permalink;
    } catch {
      return undefined;
    }
  }

  private toChannelSummary(channel: {
    id: string;
    name: string;
    is_private?: boolean;
    is_archived?: boolean;
    num_members?: number;
    topic?: { value?: string };
    purpose?: { value?: string };
  }): SlackbotChannelSummary {
    return {
      id: channel.id,
      name: channel.name,
      isPrivate: Boolean(channel.is_private),
      isArchived: Boolean(channel.is_archived),
      memberCount: channel.num_members,
      topic: channel.topic?.value?.trim() || undefined,
      purpose: channel.purpose?.value?.trim() || undefined,
    };
  }

  private defaultAccountName(auth: SlackbotAuthSummary): string {
    return auth.userName?.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "") || "default";
  }

  private describeAuth(auth: SlackbotAuthSummary, verb: string): string {
    const subject = auth.userName ? `@${auth.userName}` : auth.botName ? `bot ${auth.botName}` : auth.userId ?? auth.botUserId ?? "Slack workspace";
    const workspace = auth.team ? ` in ${auth.team}` : "";
    return `${verb} Slack access for ${subject}${workspace}.`;
  }

  private toSessionUser(auth: SlackbotAuthSummary): SessionUser | undefined {
    const username = auth.botName ?? auth.userName;
    if (!auth.userId && !auth.botUserId && !username) {
      return undefined;
    }

    return {
      id: auth.userId ?? auth.botUserId,
      username,
      displayName: auth.team,
      profileUrl: auth.url,
    };
  }

  private actionResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    id?: string;
    url?: string;
    data?: Record<string, unknown>;
  }): SlackbotActionResult {
    return {
      ok: true,
      platform: "slackbot",
      account: input.account,
      action: input.action,
      message: input.message,
      id: input.id,
      url: input.url,
      user: input.user,
      sessionPath: input.sessionPath,
      data: input.data,
    };
  }
}

export const slackbotClient = new SlackbotClient();

import { ConnectionStore } from "../../core/auth/connection-store.js";
import { AutoCliError } from "../../errors.js";
import { readFile } from "node:fs/promises";
import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformAdapter,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../../types.js";

import { DiscordApiClient } from "./client.js";
import {
  buildDiscordMessageUrl,
  formatDiscordUser,
  formatDiscordChannelType,
  normalizeDiscordBotToken,
} from "./helpers.js";
import type { DiscordChannel, DiscordGuild, DiscordMessage } from "./types.js";

type DiscordBotConnection = {
  connection: {
    account: string;
    createdAt: string;
    updatedAt: string;
    status: SessionStatus;
    user?: SessionUser;
    metadata?: Record<string, unknown>;
  };
  path: string;
  auth: {
    token: string;
    provider?: string;
  };
};

export class DiscordBotAdapter implements PlatformAdapter {
  readonly platform = "discordbot" as const;
  readonly displayName = "Discord Bot";

  private readonly connectionStore = new ConnectionStore();

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = await this.resolveTokenFromLoginInput(input);
    return this.loginWithToken({
      account: input.account,
      token,
    });
  }

  async loginWithToken(input: { token: string; account?: string }): Promise<AdapterActionResult> {
    const token = normalizeDiscordBotToken(input.token);
    const api = new DiscordApiClient({ token });
    const identity = await this.inspectIdentity(api);

    if (identity.status.state === "expired") {
      throw new AutoCliError("DISCORD_BOT_TOKEN_INVALID", identity.status.message ?? "Discord bot token is invalid.", {
        details: {
          platform: this.platform,
        },
      });
    }

    const account = input.account ?? identity.user?.username ?? identity.user?.id ?? "default";
    const sessionPath = await this.connectionStore.saveBotTokenConnection({
      platform: this.platform,
      account,
      provider: "discord",
      token,
      user: identity.user,
      status: identity.status,
      metadata: this.mergeMetadata(identity.metadata),
    });

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message: identity.status.state === "active"
        ? `Saved Discord bot token for ${identity.user?.displayName ?? identity.user?.username ?? account}.`
        : `Saved Discord bot token for ${account}, but validation was partial.`,
      user: identity.user,
      sessionPath,
      data: {
        status: identity.status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const identity = await this.inspectIdentity(api);

    await this.connectionStore.saveBotTokenConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "discord",
      token: loaded.auth.token,
      user: identity.user ?? loaded.connection.user,
      status: identity.status,
      metadata: this.mergeMetadata(loaded.connection.metadata, identity.metadata),
    });

    return {
      platform: this.platform,
      account: loaded.connection.account,
      sessionPath: loaded.path,
      connected: identity.status.state === "active",
      status: identity.status.state,
      message: identity.status.message,
      user: identity.user ?? loaded.connection.user,
      lastValidatedAt: identity.status.lastValidatedAt,
    };
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const identity = await this.inspectIdentity(api);

    await this.connectionStore.saveBotTokenConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "discord",
      token: loaded.auth.token,
      user: identity.user ?? loaded.connection.user,
      status: identity.status,
      metadata: this.mergeMetadata(loaded.connection.metadata, identity.metadata),
    });

    const message =
      identity.status.state === "active"
        ? "Loaded Discord bot identity."
        : identity.status.message ?? "Discord bot identity could not be validated.";

    return this.buildResult({
      account: loaded.connection.account,
      action: "me",
      message,
      sessionPath: loaded.path,
      user: identity.user ?? loaded.connection.user,
      data: {
        status: identity.status.state,
        user: identity.user,
        bot: true,
      },
    });
  }

  async guilds(account?: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const guilds = await api.getCurrentUserGuilds();
    const summary = guilds.map((guild) => this.summarizeGuild(guild)).sort((left, right) => left.name.localeCompare(right.name));

    await this.touchConnection(loaded, { statusMessage: "Validated via Discord guild listing." });

    return this.buildResult({
      account: loaded.connection.account,
      action: "guilds",
      message: `Found ${summary.length} Discord guild${summary.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        guilds: summary,
      },
    });
  }

  async channels(input: { account?: string; guildId: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const channels = await api.getGuildChannels(input.guildId);
    const summary = channels.map((channel) => this.summarizeChannel(channel)).sort((left, right) => {
      if (left.position !== undefined && right.position !== undefined && left.position !== right.position) {
        return left.position - right.position;
      }

      return left.name.localeCompare(right.name);
    });

    await this.touchConnection(loaded, { statusMessage: "Validated via Discord channel listing." });

    return this.buildResult({
      account: loaded.connection.account,
      action: "channels",
      message: `Found ${summary.length} channels in guild ${input.guildId}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        guildId: input.guildId,
        channels: summary,
      },
    });
  }

  async history(input: {
    account?: string;
    channelId: string;
    limit?: number;
    before?: string;
    after?: string;
    around?: string;
  }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const messages = await api.getChannelMessages(input.channelId, {
      limit: input.limit,
      before: input.before,
      after: input.after,
      around: input.around,
    });

    await this.touchConnection(loaded, { statusMessage: "Validated via Discord message history." });

    return this.buildResult({
      account: loaded.connection.account,
      action: "history",
      message: `Loaded ${messages.length} Discord message${messages.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        channelId: input.channelId,
        messages: messages.map((message) => this.summarizeMessage(message)),
      },
    });
  }

  async sendMessage(input: { account?: string; channelId: string; text: string; replyToMessageId?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const message = await api.createMessage(input.channelId, input.text, {
      replyToMessageId: input.replyToMessageId,
    });
    const channel = await api.getChannel(input.channelId).catch(() => null);

    await this.touchConnection(loaded, { statusMessage: "Validated via Discord message send." });

    return this.buildMessageResult({
      account: loaded.connection.account,
      action: "send",
      message: "Sent a Discord message.",
      sessionPath: loaded.path,
      user: loaded.connection.user,
      channelId: input.channelId,
      guildId: channel?.guild_id ?? message.guild_id ?? undefined,
      messageData: message,
    });
  }

  async sendFile(input: { account?: string; channelId: string; filePath: string; content?: string; replyToMessageId?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const message = await api.createMessageWithFile(input.channelId, {
      filePath: input.filePath,
      content: input.content,
      replyToMessageId: input.replyToMessageId,
    });
    const channel = await api.getChannel(input.channelId).catch(() => null);

    await this.touchConnection(loaded, { statusMessage: "Validated via Discord file upload." });

    return this.buildMessageResult({
      account: loaded.connection.account,
      action: "send-file",
      message: "Sent a Discord file.",
      sessionPath: loaded.path,
      user: loaded.connection.user,
      channelId: input.channelId,
      guildId: channel?.guild_id ?? message.guild_id ?? undefined,
      messageData: message,
    });
  }

  async editMessage(input: { account?: string; channelId: string; messageId: string; text: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const message = await api.editMessage(input.channelId, input.messageId, input.text);
    const channel = await api.getChannel(input.channelId).catch(() => null);

    await this.touchConnection(loaded, { statusMessage: "Validated via Discord message edit." });

    return this.buildMessageResult({
      account: loaded.connection.account,
      action: "edit",
      message: "Edited a Discord message.",
      sessionPath: loaded.path,
      user: loaded.connection.user,
      channelId: input.channelId,
      guildId: channel?.guild_id ?? message.guild_id ?? undefined,
      messageData: message,
    });
  }

  async deleteMessage(input: { account?: string; channelId: string; messageId: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const api = new DiscordApiClient({ token: loaded.auth.token });
    const channel = await api.getChannel(input.channelId).catch(() => null);
    await api.deleteMessage(input.channelId, input.messageId);

    await this.touchConnection(loaded, { statusMessage: "Validated via Discord message delete." });

    return this.buildResult({
      account: loaded.connection.account,
      action: "delete",
      message: "Deleted a Discord message.",
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: input.messageId,
      url: buildDiscordMessageUrl(input.channelId, input.messageId, channel?.guild_id ?? undefined),
      data: {
        channelId: input.channelId,
        messageId: input.messageId,
        guildId: channel?.guild_id ?? undefined,
      },
    });
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw this.unsupported("postMedia", "Discord bot posting does not support media uploads in AutoCLI yet.");
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw this.unsupported("postText", "Use discordbot send <channelId> <text> instead.");
  }

  async like(_input: LikeInput): Promise<AdapterActionResult> {
    throw this.unsupported("like", "Discord bots do not have a like action.");
  }

  async comment(_input: CommentInput): Promise<AdapterActionResult> {
    throw this.unsupported("comment", "Discord bots do not have a comment action.");
  }

  private async loadConnection(account?: string): Promise<DiscordBotConnection> {
    const loaded = await this.connectionStore.loadBotTokenConnection(this.platform, account);
    return loaded as DiscordBotConnection;
  }

  private async inspectIdentity(api: DiscordApiClient): Promise<{ user?: SessionUser; status: SessionStatus; metadata?: Record<string, unknown> }> {
    try {
      const user = await api.getCurrentUser();
      if (user.bot === false) {
        return {
          status: {
            state: "expired",
            message: "The saved token is not a Discord bot token.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "NOT_BOT_TOKEN",
          },
        };
      }

      return {
        user: formatDiscordUser(user),
        status: {
          state: "active",
          message: "Discord bot token validated successfully.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: {
          discordBot: {
            userId: user.id,
            username: user.username,
            displayName: user.global_name ?? user.username,
            avatar: user.avatar ?? null,
          },
        },
      };
    } catch (error) {
      if (error instanceof AutoCliError) {
        if (error.code === "DISCORD_UNAUTHORIZED" || error.code === "DISCORD_FORBIDDEN") {
          return {
            status: {
              state: "expired",
              message: "The saved Discord bot token was rejected by the API.",
              lastValidatedAt: new Date().toISOString(),
              lastErrorCode: error.code,
            },
          };
        }

        return {
          status: {
            state: "unknown",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
        };
      }

      return {
        status: {
          state: "unknown",
          message: error instanceof Error ? error.message : "Discord validation failed.",
          lastValidatedAt: new Date().toISOString(),
        },
      };
    }
  }

  private async touchConnection(
    loaded: DiscordBotConnection,
    input: {
      statusMessage: string;
      user?: SessionUser;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.connectionStore.saveBotTokenConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "discord",
      token: loaded.auth.token,
      user: input.user ?? loaded.connection.user,
      status: {
        state: "active",
        message: input.statusMessage,
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: this.mergeMetadata(loaded.connection.metadata, input.metadata),
    });
  }

  private buildResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    id?: string;
    url?: string;
    data?: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      id: input.id,
      url: input.url,
      data: input.data,
    };
  }

  private buildMessageResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    channelId: string;
    guildId?: string;
    messageData: DiscordMessage;
  }): AdapterActionResult {
    return this.buildResult({
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      id: input.messageData.id,
      url: buildDiscordMessageUrl(input.channelId, input.messageData.id, input.guildId ?? input.messageData.guild_id ?? undefined),
      data: {
        channelId: input.channelId,
        guildId: input.guildId ?? input.messageData.guild_id ?? undefined,
        message: {
          id: input.messageData.id,
          channelId: input.messageData.channel_id,
          guildId: input.messageData.guild_id ?? undefined,
          content: input.messageData.content,
          timestamp: input.messageData.timestamp,
          editedTimestamp: input.messageData.edited_timestamp ?? undefined,
        },
      },
    });
  }

  private summarizeGuild(guild: DiscordGuild): {
    id: string;
    name: string;
    owner?: boolean;
    memberCount?: number;
    presenceCount?: number;
    features?: string[];
  } {
    return {
      id: guild.id,
      name: guild.name,
      owner: guild.owner,
      memberCount: guild.approximate_member_count,
      presenceCount: guild.approximate_presence_count,
      features: guild.features,
    };
  }

  private summarizeChannel(channel: DiscordChannel): {
    id: string;
    name: string;
    type: string;
    topic?: string;
    position?: number;
    nsfw?: boolean;
  } {
    return {
      id: channel.id,
      name: channel.name?.trim() || "(unnamed)",
      type: formatDiscordChannelType(channel.type),
      topic: channel.topic?.trim() || undefined,
      position: channel.position,
      nsfw: channel.nsfw,
    };
  }

  private summarizeMessage(message: DiscordMessage): {
    id: string;
    content: string;
    timestamp?: string;
    editedTimestamp?: string;
    author?: string;
    attachments?: Array<{ id: string; filename: string; url?: string }>;
  } {
    return {
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
      editedTimestamp: message.edited_timestamp ?? undefined,
      author: message.author?.global_name ?? message.author?.username ?? undefined,
      attachments: message.attachments?.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        url: attachment.url,
      })),
    };
  }

  private async resolveTokenFromLoginInput(input: LoginInput): Promise<string> {
    if (input.cookieString) {
      return normalizeDiscordBotToken(input.cookieString);
    }

    if (input.cookieJson) {
      const trimmed = input.cookieJson.trim();
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (typeof parsed === "object" && parsed && "token" in parsed && typeof (parsed as { token?: unknown }).token === "string") {
          return normalizeDiscordBotToken((parsed as { token: string }).token);
        }
      } catch {
        // fall through and treat the value as a raw token string
      }

      return normalizeDiscordBotToken(trimmed);
    }

    if (input.cookieFile) {
      const token = await readFile(input.cookieFile, "utf8");
      return normalizeDiscordBotToken(token);
    }

    throw new AutoCliError("DISCORD_BOT_TOKEN_REQUIRED", "Provide a Discord bot token with --token.");
  }

  private unsupported(action: string, message: string): AutoCliError {
    return new AutoCliError("DISCORD_BOT_UNSUPPORTED", message, {
      details: {
        platform: this.platform,
        action,
      },
    });
  }

  private mergeMetadata(...parts: Array<Record<string, unknown> | undefined>): Record<string, unknown> | undefined {
    const merged = parts.reduce<Record<string, unknown>>((acc, part) => {
      if (!part) {
        return acc;
      }

      return {
        ...acc,
        ...part,
      };
    }, {});

    return Object.keys(merged).length > 0 ? merged : undefined;
  }
}

export const discordBotAdapter = new DiscordBotAdapter();

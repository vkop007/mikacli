import { sanitizeAccountName } from "../../config.js";

import type { SessionUser } from "../../types.js";
import type { DiscordChannel, DiscordCurrentUser } from "./types.js";

export const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

export interface DiscordBotIdentity {
  user?: SessionUser;
  status: {
    state: "active" | "expired" | "unknown";
    message?: string;
    lastValidatedAt?: string;
    lastErrorCode?: string;
  };
  metadata?: Record<string, unknown>;
}

export function normalizeDiscordBotToken(token: string): string {
  const normalized = token.trim().replace(/^(?:bot|bearer)\s+/iu, "").trim();
  if (!normalized) {
    throw new Error("Discord bot token is empty.");
  }

  return normalized;
}

export function formatDiscordUser(user: DiscordCurrentUser): SessionUser {
  const displayName = user.global_name?.trim() || user.username.trim();
  return {
    id: user.id,
    username: user.username,
    displayName,
    profileUrl: `https://discord.com/users/${user.id}`,
  };
}

export function buildDiscordAccountName(user: DiscordCurrentUser): string {
  return sanitizeAccountName(user.username || user.global_name || user.id);
}

export function buildDiscordMessageUrl(channelId: string, messageId: string, guildId?: string | null): string {
  return `https://discord.com/channels/${guildId?.trim() || "@me"}/${channelId}/${messageId}`;
}

export function formatDiscordChannelType(type: number): string {
  switch (type) {
    case 0:
      return "text";
    case 1:
      return "dm";
    case 2:
      return "voice";
    case 3:
      return "group-dm";
    case 4:
      return "category";
    case 5:
      return "announcement";
    case 10:
      return "announcement-thread";
    case 11:
      return "public-thread";
    case 12:
      return "private-thread";
    case 13:
      return "stage";
    case 14:
      return "directory";
    case 15:
      return "forum";
    case 16:
      return "media";
    default:
      return `type-${type}`;
  }
}

export function summarizeDiscordChannel(channel: DiscordChannel): {
  id: string;
  name: string;
  type: string;
  topic?: string;
  guildId?: string | null;
  parentId?: string | null;
  nsfw?: boolean;
  position?: number;
} {
  return {
    id: channel.id,
    name: channel.name?.trim() || "(unnamed)",
    type: formatDiscordChannelType(channel.type),
    topic: channel.topic?.trim() || undefined,
    guildId: channel.guild_id ?? undefined,
    parentId: channel.parent_id ?? undefined,
    nsfw: channel.nsfw,
    position: channel.position,
  };
}


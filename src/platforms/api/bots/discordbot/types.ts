import type { AdapterActionResult } from "../../../../types.js";

export interface DiscordBotActionResult extends Omit<AdapterActionResult, "platform"> {
  platform: "discordbot";
}

export interface DiscordCurrentUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
  bot?: boolean;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
  features?: string[];
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

export interface DiscordChannel {
  id: string;
  type: number;
  guild_id?: string | null;
  name?: string;
  topic?: string | null;
  position?: number;
  parent_id?: string | null;
  nsfw?: boolean;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  guild_id?: string | null;
  content: string;
  timestamp?: string;
  edited_timestamp?: string | null;
  attachments?: DiscordAttachment[];
  author?: {
    id: string;
    username?: string;
    global_name?: string | null;
    bot?: boolean;
  };
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  size?: number;
  url?: string;
  proxy_url?: string;
  content_type?: string | null;
}

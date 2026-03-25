import pc from "picocolors";

import { printActionResult } from "../../utils/cli.js";
import { printJson } from "../../utils/output.js";

import type { AdapterActionResult } from "../../types.js";

function printListHeader(label: string, count: number): void {
  if (count === 0) {
    console.log(pc.dim(`No ${label} found.`));
  }
}

export function printDiscordIdentityResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const user = result.data?.user as Record<string, unknown> | undefined;
  if (!user) {
    return;
  }

  const meta = [
    typeof user.displayName === "string" ? user.displayName : undefined,
    typeof user.username === "string" ? `@${user.username}` : undefined,
    typeof user.id === "string" ? user.id : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof user.profileUrl === "string") {
    console.log(`profile: ${user.profileUrl}`);
  }
}

export function printDiscordGuildsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const guilds = Array.isArray(result.data?.guilds) ? result.data.guilds : [];
  printListHeader("guilds", guilds.length);

  for (const [index, rawGuild] of guilds.entries()) {
    if (!rawGuild || typeof rawGuild !== "object") {
      continue;
    }

    const guild = rawGuild as {
      id?: string;
      name?: string;
      owner?: boolean;
      memberCount?: number;
      presenceCount?: number;
      features?: string[];
    };

    const meta = [
      typeof guild.id === "string" ? guild.id : undefined,
      typeof guild.memberCount === "number" ? `${guild.memberCount} members` : undefined,
      typeof guild.presenceCount === "number" ? `${guild.presenceCount} online` : undefined,
      guild.owner ? "owner" : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${guild.name ?? "Unnamed guild"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (Array.isArray(guild.features) && guild.features.length > 0) {
      console.log(`   features: ${guild.features.join(", ")}`);
    }
  }
}

export function printDiscordChannelsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const channels = Array.isArray(result.data?.channels) ? result.data.channels : [];
  printListHeader("channels", channels.length);

  for (const [index, rawChannel] of channels.entries()) {
    if (!rawChannel || typeof rawChannel !== "object") {
      continue;
    }

    const channel = rawChannel as {
      id?: string;
      name?: string;
      type?: string;
      topic?: string;
      nsfw?: boolean;
      position?: number;
    };

    const meta = [
      typeof channel.id === "string" ? channel.id : undefined,
      typeof channel.type === "string" ? channel.type : undefined,
      typeof channel.position === "number" ? `position ${channel.position}` : undefined,
      channel.nsfw ? "nsfw" : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${channel.name ?? "Unnamed channel"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof channel.topic === "string" && channel.topic.trim().length > 0) {
      console.log(`   ${channel.topic.trim()}`);
    }
  }
}

export function printDiscordMessageResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const message = result.data?.message as Record<string, unknown> | undefined;
  if (!message) {
    return;
  }

  if (typeof message.content === "string" && message.content.trim().length > 0) {
    const preview = message.content.length > 300 ? `${message.content.slice(0, 300)}...` : message.content;
    console.log(preview.replace(/\s+/g, " ").trim());
  }

  const meta = [
    typeof message.id === "string" ? message.id : undefined,
    typeof message.channelId === "string" ? `channel ${message.channelId}` : undefined,
    typeof message.guildId === "string" ? `guild ${message.guildId}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
}

export function printDiscordMessagesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const messages = Array.isArray(result.data?.messages) ? result.data.messages : [];
  printListHeader("messages", messages.length);

  for (const [index, rawMessage] of messages.entries()) {
    if (!rawMessage || typeof rawMessage !== "object") {
      continue;
    }

    const message = rawMessage as {
      id?: string;
      content?: string;
      timestamp?: string;
      author?: string;
      attachments?: Array<{ filename?: string }>;
    };

    const header = [
      typeof message.id === "string" ? message.id : undefined,
      typeof message.author === "string" ? message.author : undefined,
      typeof message.timestamp === "string" ? message.timestamp : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${header.join(" • ") || "message"}`);

    if (typeof message.content === "string" && message.content.trim().length > 0) {
      console.log(`   ${message.content.trim()}`);
    }

    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      const attachmentNames = message.attachments
        .map((attachment) => attachment.filename)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      if (attachmentNames.length > 0) {
        console.log(`   attachments: ${attachmentNames.join(", ")}`);
      }
    }
  }
}

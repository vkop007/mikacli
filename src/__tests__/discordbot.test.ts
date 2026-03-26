import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { discordBotPlatformDefinition } from "../platforms/api/bots/discordbot/manifest.js";
import {
  buildDiscordAccountName,
  buildDiscordMessageUrl,
  formatDiscordChannelType,
  normalizeDiscordBotToken,
  summarizeDiscordChannel,
} from "../platforms/api/bots/discordbot/helpers.js";

describe("discordbot helpers", () => {
  test("normalizes bot token input", () => {
    expect(normalizeDiscordBotToken("  Bot abc.def.ghi  ")).toBe("abc.def.ghi");
  });

  test("builds message urls", () => {
    expect(buildDiscordMessageUrl("123", "456")).toBe("https://discord.com/channels/@me/123/456");
    expect(buildDiscordMessageUrl("123", "456", "789")).toBe("https://discord.com/channels/789/123/456");
  });

  test("builds a sanitized account name", () => {
    expect(buildDiscordAccountName({ id: "1", username: "My Discord Bot" })).toBe("my-discord-bot");
  });

  test("formats channel types", () => {
    expect(formatDiscordChannelType(0)).toBe("text");
    expect(formatDiscordChannelType(15)).toBe("forum");
  });

  test("summarizes channels", () => {
    expect(
      summarizeDiscordChannel({
        id: "1",
        type: 0,
        name: "general",
        topic: "hello",
        guild_id: "2",
        position: 3,
        nsfw: false,
      }),
    ).toEqual({
      id: "1",
      name: "general",
      type: "text",
      topic: "hello",
      guildId: "2",
      parentId: undefined,
      nsfw: false,
      position: 3,
    });
  });

  test("builds a command with the expected subcommands", () => {
    const command = buildPlatformCommand(discordBotPlatformDefinition);
    expect(command.name()).toBe("discordbot");
    expect(command.commands.map((subcommand: Command) => subcommand.name())).toEqual([
      "login",
      "me",
      "guilds",
      "channels",
      "history",
      "send",
      "send-file",
      "edit",
      "delete",
    ]);
  });
});

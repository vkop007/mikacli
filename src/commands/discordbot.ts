import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { discordBotPlatformDefinition } from "../platforms/discordbot/manifest.js";

export function createDiscordBotCommand() {
  return buildPlatformCommand(discordBotPlatformDefinition);
}


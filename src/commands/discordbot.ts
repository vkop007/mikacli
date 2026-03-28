import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { discordBotPlatformDefinition } from "../platforms/bot/discordbot/manifest.js";

export function createDiscordBotCommand() {
  return buildPlatformCommand(discordBotPlatformDefinition);
}

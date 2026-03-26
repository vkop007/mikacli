import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { discordBotPlatformDefinition } from "../platforms/api/bots/discordbot/manifest.js";

export function createDiscordBotCommand() {
  return buildPlatformCommand(discordBotPlatformDefinition);
}

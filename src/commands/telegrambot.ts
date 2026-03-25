import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { telegrambotPlatformDefinition } from "../platforms/bots/telegrambot/manifest.js";

export function createTelegramBotCommand() {
  return buildPlatformCommand(telegrambotPlatformDefinition);
}

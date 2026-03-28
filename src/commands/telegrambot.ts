import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { telegrambotPlatformDefinition } from "../platforms/bot/telegrambot/manifest.js";

export function createTelegramBotCommand() {
  return buildPlatformCommand(telegrambotPlatformDefinition);
}

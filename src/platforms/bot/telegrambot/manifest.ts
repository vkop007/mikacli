import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";
import { telegrambotAdapter } from "./adapter.js";
import { telegrambotCapabilities } from "./capabilities/index.js";

export const telegrambotPlatformDefinition: PlatformDefinition = {
  id: "telegrambot",
  category: "bot",
  displayName: "Telegram Bot",
  description: "Interact with Telegram Bot API using a saved bot token",
  aliases: ["telegram"],
  authStrategies: ["botToken"],
  adapter: telegrambotAdapter,
  capabilities: telegrambotCapabilities,
  examples: [
    "mikacli telegrambot login --token 123456:ABCDEF --name alerts-bot",
    "mikacli telegrambot me",
    "mikacli telegrambot me --bot alerts-bot",
    "mikacli telegrambot chats --limit 25",
    "mikacli telegrambot getchat -1001234567890",
    "mikacli telegrambot updates --limit 10",
    'mikacli telegrambot send 123456789 "Hello from MikaCLI"',
    "mikacli telegrambot send-photo 123456789 ./photo.jpg --caption 'Hello'",
    "mikacli telegrambot send-audio 123456789 ./clip.mp3 --caption 'Listen'",
    "mikacli telegrambot edit 123456789 42 'Updated text'",
    "mikacli telegrambot delete 123456789 42",
  ],
};

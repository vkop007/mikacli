import type { PlatformDefinition } from "../../../../core/runtime/platform-definition.js";
import { telegrambotCapabilities } from "./capabilities/index.js";

export const telegrambotPlatformDefinition: PlatformDefinition = {
  id: "telegrambot",
  category: "api",
  displayName: "Telegram Bot",
  description: "Interact with Telegram Bot API using a saved bot token",
  aliases: ["telegram"],
  authStrategies: ["botToken"],
  capabilities: telegrambotCapabilities,
  examples: [
    "autocli telegrambot login --token 123456:ABCDEF --name alerts-bot",
    "autocli telegrambot me",
    "autocli telegrambot me --bot alerts-bot",
    "autocli telegrambot chats --limit 25",
    "autocli telegrambot getchat -1001234567890",
    "autocli telegrambot updates --limit 10",
    'autocli telegrambot send 123456789 "Hello from AutoCLI"',
    "autocli telegrambot send-photo 123456789 ./photo.jpg --caption 'Hello'",
    "autocli telegrambot send-audio 123456789 ./clip.mp3 --caption 'Listen'",
    "autocli telegrambot edit 123456789 42 'Updated text'",
    "autocli telegrambot delete 123456789 42",
  ],
};

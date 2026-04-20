import { discordBotAdapter } from "./adapter.js";
import { discordBotCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const discordBotPlatformDefinition: PlatformDefinition = {
  id: "discordbot",
  category: "bot",
  displayName: "Discord Bot",
  description: "Interact with Discord using a saved bot token",
  aliases: ["discord"],
  authStrategies: ["botToken"],
  adapter: discordBotAdapter,
  capabilities: discordBotCapabilities,
  examples: [
    "mikacli discordbot login --token <bot-token> --name ops-bot",
    "mikacli discordbot me",
    "mikacli discordbot guilds --bot ops-bot",
    "mikacli discordbot guilds",
    "mikacli discordbot channels 123456789012345678",
    "mikacli discordbot history 123456789012345678 --limit 20",
    'mikacli discordbot send 123456789012345678 "hello world"',
    'mikacli discordbot send-file 123456789012345678 ./report.pdf --content "build output"',
    'mikacli discordbot edit 123456789012345678 234567890123456789 "updated message"',
    "mikacli discordbot delete 123456789012345678 234567890123456789",
  ],
};

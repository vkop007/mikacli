import { discordBotAdapter } from "./adapter.js";
import { discordBotCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../core/runtime/platform-definition.js";

export const discordBotPlatformDefinition: PlatformDefinition = {
  id: "discordbot",
  displayName: "Discord Bot",
  description: "Interact with Discord using a saved bot token",
  aliases: ["discord"],
  authStrategies: ["botToken"],
  adapter: discordBotAdapter,
  capabilities: discordBotCapabilities,
  examples: [
    "autocli discordbot login --token <bot-token> --name ops-bot",
    "autocli discordbot me",
    "autocli discordbot guilds --bot ops-bot",
    "autocli discordbot guilds",
    "autocli discordbot channels 123456789012345678",
    "autocli discordbot history 123456789012345678 --limit 20",
    'autocli discordbot send 123456789012345678 "hello world"',
    'autocli discordbot send-file 123456789012345678 ./report.pdf --content "build output"',
    'autocli discordbot edit 123456789012345678 234567890123456789 "updated message"',
    "autocli discordbot delete 123456789012345678 234567890123456789",
  ],
};

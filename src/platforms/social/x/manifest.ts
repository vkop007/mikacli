import { xCapabilities } from "./capabilities/index.js";
import { xAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const xPlatformDefinition: PlatformDefinition = {
  id: "x",
  category: "social",
  displayName: "X",
  description: "Interact with X/Twitter using an imported browser session and browser-backed write flows",
  aliases: ["twitter"],
  authStrategies: ["cookies"],
  adapter: xAdapter,
  capabilities: xCapabilities,
  examples: [
    "mikacli social x login",
    "mikacli social x login --cookies ./x.cookies.json",
    "mikacli social x status",
    'mikacli social x post "Launching MikaCLI"',
    'mikacli social x post "Launching MikaCLI" --browser',
    'mikacli social x search "openai" --limit 5',
    "mikacli social x tweetid https://x.com/user/status/1234567890",
    "mikacli social x profileid @OpenAI",
    "mikacli social x tweets @OpenAI --limit 5",
    "mikacli social x delete https://x.com/user/status/1234567890",
    "mikacli social x like https://x.com/user/status/1234567890",
    "mikacli social x unlike 1234567890",
  ],
};

import { xCapabilities } from "./capabilities/index.js";
import { xAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../core/runtime/platform-definition.js";

export const xPlatformDefinition: PlatformDefinition = {
  id: "x",
  displayName: "X",
  description: "Interact with X/Twitter using an imported browser session",
  aliases: ["twitter"],
  authStrategies: ["cookies"],
  adapter: xAdapter,
  capabilities: xCapabilities,
  examples: [
    "autocli x login --cookies ./x.cookies.json",
    'autocli x post "Launching AutoCLI"',
    'autocli x search "openai" --limit 5',
    "autocli x tweetid https://x.com/user/status/1234567890",
    "autocli x profileid @OpenAI",
    "autocli x tweets @OpenAI --limit 5",
    "autocli x like https://x.com/user/status/1234567890",
    "autocli x unlike 1234567890",
  ],
};

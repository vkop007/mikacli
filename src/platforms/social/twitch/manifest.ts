import { twitchCapabilities } from "./capabilities/index.js";
import { twitchAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const twitchPlatformDefinition: PlatformDefinition = {
  id: "twitch",
  category: "social",
  displayName: "Twitch",
  description: "Inspect Twitch channels, live status, videos, and clips with an imported browser session",
  authStrategies: ["cookies"],
  adapter: twitchAdapter,
  capabilities: twitchCapabilities,
  examples: [
    "autocli social twitch login",
    "autocli social twitch login --cookies ./twitch.cookies.json",
    "autocli social twitch status",
    "autocli social twitch me",
    'autocli social twitch search "speedrun"',
    "autocli social twitch channel twitch",
    "autocli social twitch stream tradereign",
    "autocli social twitch videos twitch --limit 5",
    "autocli social twitch clips twitch --period all-time --limit 5",
  ],
};

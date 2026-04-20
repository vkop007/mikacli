import { twitchCapabilities } from "./capabilities/index.js";
import { twitchAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const twitchPlatformDefinition: PlatformDefinition = {
  id: "twitch",
  category: "social",
  displayName: "Twitch",
  description: "Inspect Twitch channels, live status, videos, and clips, then follow channels or adjust stream settings with a saved Twitch session",
  authStrategies: ["cookies"],
  adapter: twitchAdapter,
  capabilities: twitchCapabilities,
  examples: [
    "mikacli social twitch login",
    "mikacli social twitch login --cookies ./twitch.cookies.json",
    "mikacli social twitch status",
    "mikacli social twitch me",
    'mikacli social twitch search "speedrun"',
    "mikacli social twitch channel twitch",
    "mikacli social twitch stream tradereign",
    "mikacli social twitch videos twitch --limit 5",
    "mikacli social twitch clips twitch --period all-time --limit 5",
    "mikacli social twitch follow twitch",
    "mikacli social twitch unfollow twitch --browser",
    "mikacli social twitch create-clip tradereign",
    "mikacli social twitch update-stream --title \"MikaCLI live\" --category Crypto --tags trading,analysis",
  ],
};

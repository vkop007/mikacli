import { discordBotPlatformDefinition } from "./discordbot/manifest.js";
import { facebookPlatformDefinition } from "./facebook/manifest.js";
import { instagramPlatformDefinition } from "./instagram/manifest.js";
import { linkedinPlatformDefinition } from "./linkedin/manifest.js";
import { slackbotPlatformDefinition } from "./slackbot/manifest.js";
import { telegrambotPlatformDefinition } from "./telegrambot/manifest.js";
import { tiktokPlatformDefinition } from "./tiktok/manifest.js";
import { xPlatformDefinition } from "./x/manifest.js";
import { youtubePlatformDefinition } from "./youtube/manifest.js";

import type { PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { PlatformName } from "./config.js";

const definitions: readonly PlatformDefinition[] = [
  discordBotPlatformDefinition,
  facebookPlatformDefinition,
  instagramPlatformDefinition,
  linkedinPlatformDefinition,
  slackbotPlatformDefinition,
  telegrambotPlatformDefinition,
  tiktokPlatformDefinition,
  xPlatformDefinition,
  youtubePlatformDefinition,
];

export function getPlatformDefinitions(): readonly PlatformDefinition[] {
  return definitions;
}

export function getPlatformDefinition(platform: PlatformName): PlatformDefinition | undefined {
  return definitions.find((definition) => definition.id === platform);
}

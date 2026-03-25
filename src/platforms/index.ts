import { discordBotPlatformDefinition } from "./bots/discordbot/manifest.js";
import { slackbotPlatformDefinition } from "./bots/slackbot/manifest.js";
import { telegrambotPlatformDefinition } from "./bots/telegrambot/manifest.js";
import { githubPlatformDefinition } from "./api/github/manifest.js";
import { facebookPlatformDefinition } from "./social/facebook/manifest.js";
import { instagramPlatformDefinition } from "./social/instagram/manifest.js";
import { linkedinPlatformDefinition } from "./social/linkedin/manifest.js";
import { tiktokPlatformDefinition } from "./social/tiktok/manifest.js";
import { xPlatformDefinition } from "./social/x/manifest.js";
import { youtubePlatformDefinition } from "./social/youtube/manifest.js";

import type { PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { PlatformName } from "./config.js";

const definitions: readonly PlatformDefinition[] = [
  discordBotPlatformDefinition,
  facebookPlatformDefinition,
  githubPlatformDefinition,
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

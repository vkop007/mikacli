import { discordBotPlatformDefinition } from "./api/bots/discordbot/manifest.js";
import { githubbotPlatformDefinition } from "./api/bots/githubbot/manifest.js";
import { slackbotPlatformDefinition } from "./api/bots/slackbot/manifest.js";
import { telegrambotPlatformDefinition } from "./api/bots/telegrambot/manifest.js";
import { githubPlatformDefinition } from "./api/github/manifest.js";
import { gitlabPlatformDefinition } from "./api/gitlab/manifest.js";
import { linearPlatformDefinition } from "./api/linear/manifest.js";
import { spotifyPlatformDefinition } from "./music/spotify/manifest.js";
import { youtubeMusicPlatformDefinition } from "./music/youtube-music/manifest.js";
import { notionPlatformDefinition } from "./api/notion/manifest.js";
import { cheatPlatformDefinition } from "./public/cheat/manifest.js";
import { ipPlatformDefinition } from "./public/ip/manifest.js";
import { qrPlatformDefinition } from "./public/qr/manifest.js";
import { timePlatformDefinition } from "./public/time/manifest.js";
import { weatherPlatformDefinition } from "./public/weather/manifest.js";
import { webSearchPlatformDefinition } from "./public/websearch/manifest.js";
import { facebookPlatformDefinition } from "./social/facebook/manifest.js";
import { instagramPlatformDefinition } from "./social/instagram/manifest.js";
import { newsPlatformDefinition } from "./public/news/manifest.js";
import { linkedinPlatformDefinition } from "./social/linkedin/manifest.js";
import { tiktokPlatformDefinition } from "./social/tiktok/manifest.js";
import { xPlatformDefinition } from "./social/x/manifest.js";
import { youtubePlatformDefinition } from "./social/youtube/manifest.js";

import type { PlatformCategory, PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { PlatformName } from "./config.js";

const definitions: readonly PlatformDefinition[] = [
  cheatPlatformDefinition,
  discordBotPlatformDefinition,
  facebookPlatformDefinition,
  githubPlatformDefinition,
  githubbotPlatformDefinition,
  gitlabPlatformDefinition,
  ipPlatformDefinition,
  instagramPlatformDefinition,
  newsPlatformDefinition,
  linkedinPlatformDefinition,
  linearPlatformDefinition,
  notionPlatformDefinition,
  qrPlatformDefinition,
  slackbotPlatformDefinition,
  spotifyPlatformDefinition,
  telegrambotPlatformDefinition,
  tiktokPlatformDefinition,
  timePlatformDefinition,
  weatherPlatformDefinition,
  webSearchPlatformDefinition,
  xPlatformDefinition,
  youtubePlatformDefinition,
  youtubeMusicPlatformDefinition,
];

export function getPlatformDefinitions(): readonly PlatformDefinition[] {
  return definitions;
}

export function getPlatformDefinition(platform: PlatformName): PlatformDefinition | undefined {
  return definitions.find((definition) => definition.id === platform);
}

export function getPlatformDefinitionsByCategory(category: PlatformCategory): readonly PlatformDefinition[] {
  return definitions.filter((definition) => {
    const categories = definition.commandCategories ?? [definition.category];
    return categories.includes(category);
  });
}

export function getPlatformCategories(): readonly PlatformCategory[] {
  const order: readonly PlatformCategory[] = ["music", "social", "bots", "api", "public", "forum"];
  return order.filter((category) =>
    definitions.some((definition) => {
      const categories = definition.commandCategories ?? [definition.category];
      return categories.includes(category);
    }),
  );
}

import { discordBotPlatformDefinition } from "./api/bots/discordbot/manifest.js";
import { githubbotPlatformDefinition } from "./api/bots/githubbot/manifest.js";
import { slackbotPlatformDefinition } from "./api/bots/slackbot/manifest.js";
import { telegrambotPlatformDefinition } from "./api/bots/telegrambot/manifest.js";
import { githubPlatformDefinition } from "./api/github/manifest.js";
import { gitlabPlatformDefinition } from "./api/gitlab/manifest.js";
import { linearPlatformDefinition } from "./api/linear/manifest.js";
import { archiveEditorPlatformDefinition } from "./editor/archive/manifest.js";
import { audioEditorPlatformDefinition } from "./editor/audio/manifest.js";
import { documentEditorPlatformDefinition } from "./editor/document/manifest.js";
import { gifEditorPlatformDefinition } from "./editor/gif/manifest.js";
import { imageEditorPlatformDefinition } from "./editor/image/manifest.js";
import { pdfPlatformDefinition } from "./editor/pdf/manifest.js";
import { subtitleEditorPlatformDefinition } from "./editor/subtitle/manifest.js";
import { videoEditorPlatformDefinition } from "./editor/video/manifest.js";
import { amazonPlatformDefinition } from "./shopping/amazon/manifest.js";
import { flipkartPlatformDefinition } from "./shopping/flipkart/manifest.js";
import { chatgptPlatformDefinition } from "./llm/chatgpt/manifest.js";
import { claudePlatformDefinition } from "./llm/claude/manifest.js";
import { deepSeekPlatformDefinition } from "./llm/deepseek/manifest.js";
import { geminiPlatformDefinition } from "./llm/gemini/manifest.js";
import { grokPlatformDefinition } from "./llm/grok/manifest.js";
import { mistralPlatformDefinition } from "./llm/mistral/manifest.js";
import { perplexityPlatformDefinition } from "./llm/perplexity/manifest.js";
import { qwenPlatformDefinition } from "./llm/qwen/manifest.js";
import { imdbPlatformDefinition } from "./movie/imdb/manifest.js";
import { myAnimeListPlatformDefinition } from "./movie/myanimelist/manifest.js";
import { spotifyPlatformDefinition } from "./music/spotify/manifest.js";
import { youtubeMusicPlatformDefinition } from "./music/youtube-music/manifest.js";
import { notionPlatformDefinition } from "./api/notion/manifest.js";
import { cheatPlatformDefinition } from "./public/cheat/manifest.js";
import { cryptoPlatformDefinition } from "./public/crypto/manifest.js";
import { currencyPlatformDefinition } from "./public/currency/manifest.js";
import { dnsPlatformDefinition } from "./public/dns/manifest.js";
import { ipPlatformDefinition } from "./public/ip/manifest.js";
import { markdownFetchPlatformDefinition } from "./public/markdown-fetch/manifest.js";
import { qrPlatformDefinition } from "./public/qr/manifest.js";
import { screenshotPlatformDefinition } from "./public/screenshot/manifest.js";
import { robotsPlatformDefinition } from "./public/robots/manifest.js";
import { rssPlatformDefinition } from "./public/rss/manifest.js";
import { sitemapPlatformDefinition } from "./public/sitemap/manifest.js";
import { stocksPlatformDefinition } from "./public/stocks/manifest.js";
import { timePlatformDefinition } from "./public/time/manifest.js";
import { translatePlatformDefinition } from "./public/translate/manifest.js";
import { uptimePlatformDefinition } from "./public/uptime/manifest.js";
import { weatherPlatformDefinition } from "./public/weather/manifest.js";
import { webSearchPlatformDefinition } from "./public/websearch/manifest.js";
import { whoisPlatformDefinition } from "./public/whois/manifest.js";
import { zaiPlatformDefinition } from "./llm/zai/manifest.js";
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
  amazonPlatformDefinition,
  cheatPlatformDefinition,
  chatgptPlatformDefinition,
  claudePlatformDefinition,
  cryptoPlatformDefinition,
  currencyPlatformDefinition,
  deepSeekPlatformDefinition,
  dnsPlatformDefinition,
  discordBotPlatformDefinition,
  archiveEditorPlatformDefinition,
  audioEditorPlatformDefinition,
  documentEditorPlatformDefinition,
  gifEditorPlatformDefinition,
  imageEditorPlatformDefinition,
  facebookPlatformDefinition,
  flipkartPlatformDefinition,
  geminiPlatformDefinition,
  grokPlatformDefinition,
  imdbPlatformDefinition,
  mistralPlatformDefinition,
  myAnimeListPlatformDefinition,
  perplexityPlatformDefinition,
  qwenPlatformDefinition,
  zaiPlatformDefinition,
  githubPlatformDefinition,
  githubbotPlatformDefinition,
  gitlabPlatformDefinition,
  ipPlatformDefinition,
  instagramPlatformDefinition,
  markdownFetchPlatformDefinition,
  newsPlatformDefinition,
  linkedinPlatformDefinition,
  linearPlatformDefinition,
  notionPlatformDefinition,
  pdfPlatformDefinition,
  qrPlatformDefinition,
  screenshotPlatformDefinition,
  robotsPlatformDefinition,
  rssPlatformDefinition,
  sitemapPlatformDefinition,
  slackbotPlatformDefinition,
  spotifyPlatformDefinition,
  stocksPlatformDefinition,
  telegrambotPlatformDefinition,
  tiktokPlatformDefinition,
  timePlatformDefinition,
  translatePlatformDefinition,
  uptimePlatformDefinition,
  subtitleEditorPlatformDefinition,
  videoEditorPlatformDefinition,
  weatherPlatformDefinition,
  webSearchPlatformDefinition,
  whoisPlatformDefinition,
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
  const order: readonly PlatformCategory[] = ["llm", "editor", "movie", "music", "social", "shopping", "bots", "api", "public", "forum"];
  return order.filter((category) =>
    definitions.some((definition) => {
      const categories = definition.commandCategories ?? [definition.category];
      return categories.includes(category);
    }),
  );
}

import { discordBotPlatformDefinition } from "./bot/discordbot/manifest.js";
import { githubbotPlatformDefinition } from "./bot/githubbot/manifest.js";
import { slackbotPlatformDefinition } from "./bot/slackbot/manifest.js";
import { telegrambotPlatformDefinition } from "./bot/telegrambot/manifest.js";
import { githubPlatformDefinition } from "./developer/github/manifest.js";
import { gitlabPlatformDefinition } from "./developer/gitlab/manifest.js";
import { linearPlatformDefinition } from "./developer/linear/manifest.js";
import { archiveEditorPlatformDefinition } from "./editor/archive/manifest.js";
import { audioEditorPlatformDefinition } from "./editor/audio/manifest.js";
import { documentEditorPlatformDefinition } from "./editor/document/manifest.js";
import { cryptoPlatformDefinition } from "./finance/crypto/manifest.js";
import { currencyPlatformDefinition } from "./finance/currency/manifest.js";
import { stocksPlatformDefinition } from "./finance/stocks/manifest.js";
import { geoPlatformDefinition } from "./maps/geo/manifest.js";
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
import { aniListPlatformDefinition } from "./movie/anilist/manifest.js";
import { imdbPlatformDefinition } from "./movie/imdb/manifest.js";
import { justWatchPlatformDefinition } from "./movie/justwatch/manifest.js";
import { kitsuPlatformDefinition } from "./movie/kitsu/manifest.js";
import { myAnimeListPlatformDefinition } from "./movie/myanimelist/manifest.js";
import { tvMazePlatformDefinition } from "./movie/tvmaze/manifest.js";
import { openStreetMapPlatformDefinition } from "./maps/openstreetmap/manifest.js";
import { osrmPlatformDefinition } from "./maps/osrm/manifest.js";
import { spotifyPlatformDefinition } from "./music/spotify/manifest.js";
import { youtubeMusicPlatformDefinition } from "./music/youtube-music/manifest.js";
import { notionPlatformDefinition } from "./developer/notion/manifest.js";
import { cheatPlatformDefinition } from "./tools/cheat/manifest.js";
import { dnsPlatformDefinition } from "./tools/dns/manifest.js";
import { ipPlatformDefinition } from "./tools/ip/manifest.js";
import { markdownFetchPlatformDefinition } from "./tools/markdown-fetch/manifest.js";
import { qrPlatformDefinition } from "./tools/qr/manifest.js";
import { screenshotPlatformDefinition } from "./tools/screenshot/manifest.js";
import { robotsPlatformDefinition } from "./tools/robots/manifest.js";
import { rssPlatformDefinition } from "./tools/rss/manifest.js";
import { sitemapPlatformDefinition } from "./tools/sitemap/manifest.js";
import { timePlatformDefinition } from "./tools/time/manifest.js";
import { translatePlatformDefinition } from "./tools/translate/manifest.js";
import { uptimePlatformDefinition } from "./tools/uptime/manifest.js";
import { weatherPlatformDefinition } from "./tools/weather/manifest.js";
import { webSearchPlatformDefinition } from "./tools/websearch/manifest.js";
import { whoisPlatformDefinition } from "./tools/whois/manifest.js";
import { zaiPlatformDefinition } from "./llm/zai/manifest.js";
import { facebookPlatformDefinition } from "./social/facebook/manifest.js";
import { instagramPlatformDefinition } from "./social/instagram/manifest.js";
import { newsPlatformDefinition } from "./tools/news/manifest.js";
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
  geoPlatformDefinition,
  gifEditorPlatformDefinition,
  imageEditorPlatformDefinition,
  facebookPlatformDefinition,
  flipkartPlatformDefinition,
  geminiPlatformDefinition,
  grokPlatformDefinition,
  openStreetMapPlatformDefinition,
  osrmPlatformDefinition,
  aniListPlatformDefinition,
  imdbPlatformDefinition,
  justWatchPlatformDefinition,
  kitsuPlatformDefinition,
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
  tvMazePlatformDefinition,
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
  const order: readonly PlatformCategory[] = ["llm", "editor", "finance", "maps", "movie", "music", "social", "shopping", "developer", "bot", "tools", "forum"];
  return order.filter((category) =>
    definitions.some((definition) => {
      const categories = definition.commandCategories ?? [definition.category];
      return categories.includes(category);
    }),
  );
}

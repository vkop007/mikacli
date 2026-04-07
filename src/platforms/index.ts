import { discordBotPlatformDefinition } from "./bot/discordbot/manifest.js";
import { githubbotPlatformDefinition } from "./bot/githubbot/manifest.js";
import { slackbotPlatformDefinition } from "./bot/slackbot/manifest.js";
import { telegrambotPlatformDefinition } from "./bot/telegrambot/manifest.js";
import { csvPlatformDefinition } from "./data/csv/manifest.js";
import { htmlPlatformDefinition } from "./data/html/manifest.js";
import { jsonPlatformDefinition } from "./data/json/manifest.js";
import { markdownPlatformDefinition } from "./data/markdown/manifest.js";
import { textPlatformDefinition } from "./data/text/manifest.js";
import { xmlPlatformDefinition } from "./data/xml/manifest.js";
import { yamlPlatformDefinition } from "./data/yaml/manifest.js";
import { confluencePlatformDefinition } from "./developer/confluence/manifest.js";
import { cloudflarePlatformDefinition } from "./devops/cloudflare/manifest.js";
import { digitalOceanPlatformDefinition } from "./devops/digitalocean/manifest.js";
import { githubPlatformDefinition } from "./developer/github/manifest.js";
import { gitlabPlatformDefinition } from "./developer/gitlab/manifest.js";
import { flyPlatformDefinition } from "./devops/fly/manifest.js";
import { jiraPlatformDefinition } from "./developer/jira/manifest.js";
import { linearPlatformDefinition } from "./developer/linear/manifest.js";
import { supabasePlatformDefinition } from "./devops/supabase/manifest.js";
import { uptimeRobotPlatformDefinition } from "./devops/uptimerobot/manifest.js";
import { archiveEditorPlatformDefinition } from "./editor/archive/manifest.js";
import { audioEditorPlatformDefinition } from "./editor/audio/manifest.js";
import { documentEditorPlatformDefinition } from "./editor/document/manifest.js";
import { cryptoPlatformDefinition } from "./finance/crypto/manifest.js";
import { currencyPlatformDefinition } from "./finance/currency/manifest.js";
import { stocksPlatformDefinition } from "./finance/stocks/manifest.js";
import { downloadPlatformDefinition } from "./tools/download/manifest.js";
import { geoPlatformDefinition } from "./maps/geo/manifest.js";
import { gifEditorPlatformDefinition } from "./editor/gif/manifest.js";
import { imageEditorPlatformDefinition } from "./editor/image/manifest.js";
import { pdfPlatformDefinition } from "./editor/pdf/manifest.js";
import { subtitleEditorPlatformDefinition } from "./editor/subtitle/manifest.js";
import { videoEditorPlatformDefinition } from "./editor/video/manifest.js";
import { amazonPlatformDefinition } from "./shopping/amazon/manifest.js";
import { bandcampPlatformDefinition } from "./music/bandcamp/manifest.js";
import { ebayPlatformDefinition } from "./shopping/ebay/manifest.js";
import { etsyPlatformDefinition } from "./shopping/etsy/manifest.js";
import { flipkartPlatformDefinition } from "./shopping/flipkart/manifest.js";
import { chatgptPlatformDefinition } from "./llm/chatgpt/manifest.js";
import { claudePlatformDefinition } from "./llm/claude/manifest.js";
import { deepSeekPlatformDefinition } from "./llm/deepseek/manifest.js";
import { deezerPlatformDefinition } from "./music/deezer/manifest.js";
import { geminiPlatformDefinition } from "./llm/gemini/manifest.js";
import { grokPlatformDefinition } from "./llm/grok/manifest.js";
import { mistralPlatformDefinition } from "./llm/mistral/manifest.js";
import { perplexityPlatformDefinition } from "./llm/perplexity/manifest.js";
import { qwenPlatformDefinition } from "./llm/qwen/manifest.js";
import { aniListPlatformDefinition } from "./movie/anilist/manifest.js";
import { imdbPlatformDefinition } from "./movie/imdb/manifest.js";
import { justWatchPlatformDefinition } from "./movie/justwatch/manifest.js";
import { kitsuPlatformDefinition } from "./movie/kitsu/manifest.js";
import { letterboxdPlatformDefinition } from "./movie/letterboxd/manifest.js";
import { myAnimeListPlatformDefinition } from "./movie/myanimelist/manifest.js";
import { tmdbPlatformDefinition } from "./movie/tmdb/manifest.js";
import { tvMazePlatformDefinition } from "./movie/tvmaze/manifest.js";
import { openStreetMapPlatformDefinition } from "./maps/openstreetmap/manifest.js";
import { osrmPlatformDefinition } from "./maps/osrm/manifest.js";
import { soundCloudPlatformDefinition } from "./music/soundcloud/manifest.js";
import { spotifyPlatformDefinition } from "./music/spotify/manifest.js";
import { youtubeMusicPlatformDefinition } from "./music/youtube-music/manifest.js";
import { notionPlatformDefinition } from "./developer/notion/manifest.js";
import { blueskyPlatformDefinition } from "./social/bluesky/manifest.js";
import { pinterestPlatformDefinition } from "./social/pinterest/manifest.js";
import { redditPlatformDefinition } from "./social/reddit/manifest.js";
import { cheatPlatformDefinition } from "./tools/cheat/manifest.js";
import { dnsPlatformDefinition } from "./tools/dns/manifest.js";
import { faviconPlatformDefinition } from "./tools/favicon/manifest.js";
import { headersPlatformDefinition } from "./tools/headers/manifest.js";
import { httpPlatformDefinition } from "./tools/http/manifest.js";
import { ipPlatformDefinition } from "./tools/ip/manifest.js";
import { markdownFetchPlatformDefinition } from "./tools/markdown-fetch/manifest.js";
import { mastodonPlatformDefinition } from "./social/mastodon/manifest.js";
import { metadataPlatformDefinition } from "./tools/metadata/manifest.js";
import { oEmbedPlatformDefinition } from "./tools/oembed/manifest.js";
import { pageLinksPlatformDefinition } from "./tools/page-links/manifest.js";
import { qrPlatformDefinition } from "./tools/qr/manifest.js";
import { redirectPlatformDefinition } from "./tools/redirect/manifest.js";
import { screenshotPlatformDefinition } from "./tools/screenshot/manifest.js";
import { robotsPlatformDefinition } from "./tools/robots/manifest.js";
import { rssPlatformDefinition } from "./tools/rss/manifest.js";
import { sitemapPlatformDefinition } from "./tools/sitemap/manifest.js";
import { sslPlatformDefinition } from "./tools/ssl/manifest.js";
import { timePlatformDefinition } from "./tools/time/manifest.js";
import { timezonePlatformDefinition } from "./tools/timezone/manifest.js";
import { translatePlatformDefinition } from "./tools/translate/manifest.js";
import { uptimePlatformDefinition } from "./tools/uptime/manifest.js";
import { weatherPlatformDefinition } from "./tools/weather/manifest.js";
import { webSearchPlatformDefinition } from "./tools/websearch/manifest.js";
import { whoisPlatformDefinition } from "./tools/whois/manifest.js";
import { zaiPlatformDefinition } from "./llm/zai/manifest.js";
import { facebookPlatformDefinition } from "./social/facebook/manifest.js";
import { instagramPlatformDefinition } from "./social/instagram/manifest.js";
import { newsPlatformDefinition } from "./news/news/manifest.js";
import { netlifyPlatformDefinition } from "./devops/netlify/manifest.js";
import { linkedinPlatformDefinition } from "./social/linkedin/manifest.js";
import { railwayPlatformDefinition } from "./devops/railway/manifest.js";
import { renderPlatformDefinition } from "./devops/render/manifest.js";
import { telegramPlatformDefinition } from "./social/telegram/manifest.js";
import { threadsPlatformDefinition } from "./social/threads/manifest.js";
import { tiktokPlatformDefinition } from "./social/tiktok/manifest.js";
import { trelloPlatformDefinition } from "./developer/trello/manifest.js";
import { vercelPlatformDefinition } from "./devops/vercel/manifest.js";
import { whatsappPlatformDefinition } from "./social/whatsapp/manifest.js";
import { xPlatformDefinition } from "./social/x/manifest.js";
import { youtubePlatformDefinition } from "./social/youtube/manifest.js";

import type { PlatformCategory, PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { PlatformName } from "./config.js";

const definitions: readonly PlatformDefinition[] = [
  amazonPlatformDefinition,
  bandcampPlatformDefinition,
  blueskyPlatformDefinition,
  cheatPlatformDefinition,
  chatgptPlatformDefinition,
  claudePlatformDefinition,
  cloudflarePlatformDefinition,
  confluencePlatformDefinition,
  cryptoPlatformDefinition,
  currencyPlatformDefinition,
  downloadPlatformDefinition,
  deepSeekPlatformDefinition,
  deezerPlatformDefinition,
  digitalOceanPlatformDefinition,
  dnsPlatformDefinition,
  discordBotPlatformDefinition,
  archiveEditorPlatformDefinition,
  audioEditorPlatformDefinition,
  csvPlatformDefinition,
  documentEditorPlatformDefinition,
  ebayPlatformDefinition,
  faviconPlatformDefinition,
  geoPlatformDefinition,
  gifEditorPlatformDefinition,
  htmlPlatformDefinition,
  imageEditorPlatformDefinition,
  etsyPlatformDefinition,
  facebookPlatformDefinition,
  flipkartPlatformDefinition,
  flyPlatformDefinition,
  geminiPlatformDefinition,
  grokPlatformDefinition,
  openStreetMapPlatformDefinition,
  osrmPlatformDefinition,
  aniListPlatformDefinition,
  imdbPlatformDefinition,
  justWatchPlatformDefinition,
  kitsuPlatformDefinition,
  letterboxdPlatformDefinition,
  jsonPlatformDefinition,
  markdownPlatformDefinition,
  mistralPlatformDefinition,
  myAnimeListPlatformDefinition,
  tmdbPlatformDefinition,
  netlifyPlatformDefinition,
  perplexityPlatformDefinition,
  qwenPlatformDefinition,
  railwayPlatformDefinition,
  renderPlatformDefinition,
  zaiPlatformDefinition,
  githubPlatformDefinition,
  githubbotPlatformDefinition,
  gitlabPlatformDefinition,
  httpPlatformDefinition,
  headersPlatformDefinition,
  ipPlatformDefinition,
  instagramPlatformDefinition,
  jiraPlatformDefinition,
  markdownFetchPlatformDefinition,
  metadataPlatformDefinition,
  newsPlatformDefinition,
  oEmbedPlatformDefinition,
  pageLinksPlatformDefinition,
  linkedinPlatformDefinition,
  mastodonPlatformDefinition,
  linearPlatformDefinition,
  notionPlatformDefinition,
  pdfPlatformDefinition,
  qrPlatformDefinition,
  redirectPlatformDefinition,
  screenshotPlatformDefinition,
  robotsPlatformDefinition,
  rssPlatformDefinition,
  sitemapPlatformDefinition,
  slackbotPlatformDefinition,
  sslPlatformDefinition,
  soundCloudPlatformDefinition,
  spotifyPlatformDefinition,
  stocksPlatformDefinition,
  textPlatformDefinition,
  pinterestPlatformDefinition,
  redditPlatformDefinition,
  telegramPlatformDefinition,
  telegrambotPlatformDefinition,
  threadsPlatformDefinition,
  tiktokPlatformDefinition,
  timePlatformDefinition,
  timezonePlatformDefinition,
  trelloPlatformDefinition,
  translatePlatformDefinition,
  tvMazePlatformDefinition,
  uptimePlatformDefinition,
  subtitleEditorPlatformDefinition,
  supabasePlatformDefinition,
  uptimeRobotPlatformDefinition,
  videoEditorPlatformDefinition,
  vercelPlatformDefinition,
  weatherPlatformDefinition,
  webSearchPlatformDefinition,
  whatsappPlatformDefinition,
  whoisPlatformDefinition,
  xPlatformDefinition,
  xmlPlatformDefinition,
  yamlPlatformDefinition,
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
  const order: readonly PlatformCategory[] = ["llm", "editor", "finance", "data", "maps", "movie", "news", "music", "social", "shopping", "developer", "devops", "bot", "tools", "forum"];
  return order.filter((category) =>
    definitions.some((definition) => {
      const categories = definition.commandCategories ?? [definition.category];
      return categories.includes(category);
    }),
  );
}

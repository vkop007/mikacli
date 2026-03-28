import { AutoCliError } from "../../../errors.js";

export const NEWS_SOURCES = ["google", "gdelt", "hn", "reddit", "rss"] as const;

export type NewsSourceId = (typeof NEWS_SOURCES)[number];

export type NewsSourceScope = NewsSourceId | "all";

export interface NewsSourceInfo {
  id: NewsSourceId;
  label: string;
  description: string;
  supportsTop: boolean;
  supportsSearch: boolean;
  supportsFeed: boolean;
  defaultHint: string;
}

export interface NewsItem {
  source: NewsSourceId;
  sourceLabel: string;
  title: string;
  url: string;
  snippet?: string;
  summary?: string;
  publishedAt?: string;
  author?: string;
  feedTitle?: string;
  query?: string;
}

export interface NewsFeedDocument {
  title?: string;
  url: string;
  items: NewsItem[];
}

export const NEWS_SOURCE_INFO: Record<NewsSourceId, NewsSourceInfo> = {
  google: {
    id: "google",
    label: "Google News RSS",
    description: "Google News RSS top stories and search feeds",
    supportsTop: true,
    supportsSearch: true,
    supportsFeed: false,
    defaultHint: "Top stories and query RSS",
  },
  gdelt: {
    id: "gdelt",
    label: "GDELT DOC 2.0",
    description: "Open global news index with queryable article listings",
    supportsTop: true,
    supportsSearch: true,
    supportsFeed: false,
    defaultHint: "Queryable article index",
  },
  hn: {
    id: "hn",
    label: "Hacker News",
    description: "Official Firebase API for top stories and article metadata",
    supportsTop: true,
    supportsSearch: false,
    supportsFeed: false,
    defaultHint: "Top stories only",
  },
  reddit: {
    id: "reddit",
    label: "Reddit JSON",
    description: "Public Reddit JSON search and hot listings",
    supportsTop: true,
    supportsSearch: true,
    supportsFeed: false,
    defaultHint: "Subreddit hot or site search",
  },
  rss: {
    id: "rss",
    label: "RSS / Atom",
    description: "Generic feed parser for any RSS or Atom URL",
    supportsTop: false,
    supportsSearch: false,
    supportsFeed: true,
    defaultHint: "Generic feed URL",
  },
};

export function normalizeNewsSource(value: string | undefined): NewsSourceScope {
  if (!value || value.trim().length === 0) {
    return "all";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "*") {
    return "all";
  }

  if (normalized === "google-news" || normalized === "googlenews") {
    return "google";
  }

  if (normalized === "hackernews" || normalized === "hacker-news" || normalized === "hacker_news") {
    return "hn";
  }

  if ((NEWS_SOURCES as readonly string[]).includes(normalized)) {
    return normalized as NewsSourceId;
  }

  throw new AutoCliError("NEWS_SOURCE_INVALID", `Unknown news source "${value}". Supported sources: all, ${NEWS_SOURCES.join(", ")}.`, {
    details: {
      source: value,
      supportedSources: ["all", ...NEWS_SOURCES],
    },
  });
}

export function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizePositiveInteger(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${fieldName} "${value}". Expected a positive integer.`);
  }

  return parsed;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildGoogleNewsRssUrl(input: {
  query?: string;
  language?: string;
  region?: string;
}): string {
  const language = normalizeLocaleLanguage(input.language);
  const region = normalizeLocaleRegion(input.region);
  const url = new URL(input.query ? "https://news.google.com/rss/search" : "https://news.google.com/rss");

  if (input.query) {
    url.searchParams.set("q", input.query.trim());
  }

  url.searchParams.set("hl", `${language}-${region}`);
  url.searchParams.set("gl", region);
  url.searchParams.set("ceid", `${region}:${language}`);
  return url.toString();
}

export function buildGdeltUrl(input: {
  query?: string;
  limit: number;
  language?: string;
}): string {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  const queryParts = [normalizeOptionalText(input.query), gdeltLanguageFilter(input.language)].filter(
    (part): part is string => Boolean(part),
  );

  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "HybridRel");
  url.searchParams.set("maxrecords", String(clamp(Math.trunc(input.limit), 1, 50)));
  url.searchParams.set("query", queryParts.length > 0 ? queryParts.join(" ") : "language:english");
  return url.toString();
}

export function buildRedditSearchUrl(input: {
  query: string;
  limit: number;
  subreddit?: string;
}): string {
  const query = input.query.trim();
  const limit = clamp(Math.trunc(input.limit), 1, 50);
  const subreddit = normalizeOptionalText(input.subreddit);

  if (subreddit) {
    const url = new URL(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json`);
    url.searchParams.set("q", query);
    url.searchParams.set("restrict_sr", "1");
    url.searchParams.set("sort", "top");
    url.searchParams.set("t", "day");
    url.searchParams.set("limit", String(limit));
    return url.toString();
  }

  const url = new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "top");
  url.searchParams.set("t", "day");
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export function buildRedditHotUrl(input: {
  subreddit?: string;
  limit: number;
}): string {
  const subreddit = normalizeOptionalText(input.subreddit) ?? "news";
  const url = new URL(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json`);
  url.searchParams.set("limit", String(clamp(Math.trunc(input.limit), 1, 50)));
  return url.toString();
}

export function buildHackerNewsTopUrl(): string {
  return "https://hacker-news.firebaseio.com/v0/topstories.json";
}

export function buildHackerNewsItemUrl(id: number): string {
  return `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
}

export function extractNewsPageSummary(html: string): string | undefined {
  const metaDescription = extractMetaDescription(html);
  if (metaDescription) {
    return truncateSummary(metaDescription);
  }

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter((entry) => isUsefulSummaryText(entry));

  if (paragraphs.length > 0) {
    return truncateSummary(joinSummaryParts(paragraphs, 2));
  }

  const articleLikeBlocks = [...html.matchAll(/<(article|main|section)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripHtml(match[2] ?? ""))
    .filter((entry) => isUsefulSummaryText(entry));

  if (articleLikeBlocks.length > 0) {
    return truncateSummary(articleLikeBlocks[0] ?? "");
  }

  const plainText = stripHtml(html);
  if (isUsefulSummaryText(plainText)) {
    return truncateSummary(plainText);
  }

  return undefined;
}

export function stripHtml(html: string): string {
  const withoutCdata = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  return decodeHtmlEntities(
    withoutCdata
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\]\]>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

export function parseNewsFeedDocument(xml: string, feedUrl: string): NewsFeedDocument {
  const feedTitle = normalizeOptionalText(extractTagText(xml, "title"));
  const blocks = extractRssItemBlocks(xml).length > 0 ? extractRssItemBlocks(xml) : extractAtomEntryBlocks(xml);

  const items = blocks
    .map((block) => parseNewsFeedItem(block, feedUrl, feedTitle))
    .filter((item): item is NewsItem => Boolean(item))
    .slice(0, 50);

  if (items.length === 0) {
    throw new AutoCliError("NEWS_FEED_EMPTY", "The feed did not contain any usable items.", {
      details: {
        feedUrl,
      },
    });
  }

  return {
    title: feedTitle,
    url: feedUrl,
    items,
  };
}

export function parseNewsFeedItem(block: string, feedUrl: string, feedTitle?: string): NewsItem | undefined {
  const atom = block.includes("<entry");
  const title = normalizeOptionalText(extractTagText(block, "title")) ?? "Untitled story";
  const url = atom ? parseAtomLink(block, feedUrl) : parseRssLink(block, feedUrl);

  if (!url) {
    return undefined;
  }

  const snippet =
    normalizeOptionalText(extractTagText(block, "description")) ??
    normalizeOptionalText(extractTagText(block, "summary")) ??
    normalizeOptionalText(extractTagText(block, "content")) ??
    normalizeOptionalText(extractTagText(block, "content:encoded"));

  const publishedAt =
    normalizeOptionalText(extractTagText(block, "pubDate")) ??
    normalizeOptionalText(extractTagText(block, "published")) ??
    normalizeOptionalText(extractTagText(block, "updated")) ??
    normalizeOptionalText(extractTagText(block, "dc:date"));

  const author =
    normalizeOptionalText(extractTagText(block, "author")) ??
    normalizeOptionalText(extractTagText(block, "creator")) ??
    normalizeOptionalText(extractTagText(block, "dc:creator"));

  return {
    source: "rss",
    sourceLabel: feedTitle ? `RSS: ${feedTitle}` : "RSS / Atom",
    title,
    url,
    snippet: snippet ? stripHtml(snippet) : undefined,
    publishedAt,
    author,
    feedTitle,
  };
}

export async function fetchNewsPageSummary(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("text/")) {
      return undefined;
    }

    const body = await response.text();
    return extractNewsPageSummary(body);
  } catch {
    return undefined;
  }
}

export function dedupeNewsItems(items: NewsItem[], limit: number): NewsItem[] {
  const seen = new Set<string>();
  const output: NewsItem[] = [];

  for (const item of items) {
    const key = canonicalNewsKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

export function formatNewsSourceScope(source: NewsSourceScope): string {
  return source === "all" ? "all" : source;
}

function canonicalNewsKey(item: NewsItem): string {
  return `${normalizeUrlForDedup(item.url)}:${item.title.toLowerCase()}`;
}

function normalizeUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function normalizeLocaleLanguage(value: string | undefined): string {
  const normalized = normalizeOptionalText(value)?.replace(/_/g, "-").toLowerCase();
  if (!normalized) {
    return "en";
  }

  return normalized.split("-")[0] ?? "en";
}

function normalizeLocaleRegion(value: string | undefined): string {
  const normalized = normalizeOptionalText(value)?.replace(/_/g, "-").toUpperCase();
  if (!normalized) {
    return "US";
  }

  return normalized.split("-")[0] ?? "US";
}

function gdeltLanguageFilter(language: string | undefined): string | undefined {
  const mapping: Record<string, string> = {
    en: "language:english",
    es: "language:spanish",
    fr: "language:french",
    de: "language:german",
    hi: "language:hindi",
    pt: "language:portuguese",
    it: "language:italian",
    ja: "language:japanese",
    ko: "language:korean",
    ru: "language:russian",
  };

  const normalized = normalizeOptionalText(language)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return mapping[normalized] ?? undefined;
}

function extractRssItemBlocks(xml: string): string[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0] ?? "");
}

function extractAtomEntryBlocks(xml: string): string[] {
  return [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0] ?? "");
}

function parseRssLink(block: string, feedUrl: string): string | undefined {
  const directLink = normalizeOptionalText(extractTagText(block, "link"));
  if (directLink) {
    return resolveNewsUrl(directLink, feedUrl);
  }

  const guid = normalizeOptionalText(extractTagText(block, "guid"));
  if (guid) {
    return resolveNewsUrl(guid, feedUrl);
  }

  return undefined;
}

function parseAtomLink(block: string, feedUrl: string): string | undefined {
  const alternateLink =
    block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1] ??
    block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/i)?.[1] ??
    block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1];

  const href = normalizeOptionalText(alternateLink) ?? normalizeOptionalText(extractTagText(block, "link"));
  if (!href) {
    return undefined;
  }

  return resolveNewsUrl(href, feedUrl);
}

function resolveNewsUrl(href: string, feedUrl: string): string | undefined {
  const trimmed = decodeHtmlEntities(href).trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed) || trimmed.startsWith("#")) {
    return undefined;
  }

  try {
    return new URL(trimmed, feedUrl).toString();
  } catch {
    return undefined;
  }
}

function extractTagText(source: string, tagName: string): string | undefined {
  const escapedTag = escapeRegExp(tagName);
  const variants = [
    new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\/${escapedTag}>`, "i"),
    new RegExp(`<(?:[\\w.-]+:)?${escapedTag}\\b[^>]*>([\\s\\S]*?)<\/(?:[\\w.-]+:)?${escapedTag}>`, "i"),
  ];

  for (const pattern of variants) {
    const match = source.match(pattern);
    if (match) {
      return stripHtml(match[1] ?? "");
    }
  }

  return undefined;
}

function extractMetaDescription(html: string): string | undefined {
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  for (const tag of metaTags) {
    const normalized = tag.toLowerCase();
    if (
      normalized.includes('name="description"') ||
      normalized.includes("name='description'") ||
      normalized.includes('property="og:description"') ||
      normalized.includes("property='og:description'") ||
      normalized.includes('name="twitter:description"') ||
      normalized.includes("name='twitter:description'")
    ) {
      const content = tag.match(/\bcontent="([^"]*)"/i)?.[1] ?? tag.match(/\bcontent='([^']*)'/i)?.[1];
      const value = stripHtml(content ?? "");
      if (isUsefulSummaryText(value)) {
        return value;
      }
    }
  }

  return undefined;
}

function isUsefulSummaryText(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 60) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered.includes("skip to main content") ||
    lowered.includes("cookie settings") ||
    lowered.includes("open menu") ||
    lowered.startsWith("enable javascript") ||
    lowered.includes("cookie preferences") ||
    lowered.includes("accept cookies") ||
    lowered.includes("sign in") ||
    lowered.includes("subscribe now")
  ) {
    return false;
  }

  return true;
}

function truncateSummary(value: string, maxLength = 320): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const shortened = normalized.slice(0, maxLength);
  const lastBoundary = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf(" "), shortened.lastIndexOf(", "));
  const trimmed = lastBoundary > 120 ? shortened.slice(0, lastBoundary) : shortened;
  return `${trimmed.trim()}...`;
}

function joinSummaryParts(parts: string[], maxParts: number): string {
  return parts
    .slice(0, maxParts)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

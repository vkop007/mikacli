import {
  absoluteSearchResultUrl,
  dedupeWebSearchResults,
  getWebSearchEngineInfo,
  isUsefulSearchResult,
  stripHtml,
  type WebSearchEngine,
  type WebSearchResult,
} from "./helpers.js";
import { MikaCliError } from "../../../errors.js";

export class WebSearchClient {
  async search(input: {
    engine: WebSearchEngine;
    query: string;
    limit: number;
    summary?: boolean;
    summaryLimit?: number;
  }): Promise<{ engine: WebSearchEngine; query: string; searchUrl: string; results: WebSearchResult[] }> {
    const engineInfo = getWebSearchEngineInfo(input.engine);
    const searchUrl = engineInfo.searchUrl(input.query);
    let response: Response;
    try {
      response = await fetch(searchUrl, {
        signal: AbortSignal.timeout(12000),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      throw createSearchFetchError(input.engine, engineInfo.label, searchUrl, input.query, error);
    }

    if (!response.ok) {
      throw new MikaCliError("WEBSEARCH_ENGINE_HTTP_ERROR", `${engineInfo.label} search returned ${response.status} ${response.statusText}.`, {
        details: {
          engine: input.engine,
          query: input.query,
          searchUrl,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const html = await response.text();
    if (response.headers.get("x-yandex-captcha") === "captcha" || isBlockedSearchResponse(input.engine, html)) {
      throw new MikaCliError(
        "WEBSEARCH_ENGINE_BLOCKED",
        `${engineInfo.label} returned an anti-bot or JavaScript fallback page instead of real search results.`,
        {
          details: {
            engine: input.engine,
            searchUrl,
          },
        },
      );
    }

    const results = parseSearchResults(input.engine, html, searchUrl, input.limit);
    const enrichedResults = input.summary ? await this.attachSummaries(results, input.summaryLimit ?? 3) : results;
    return {
      engine: input.engine,
      query: input.query,
      searchUrl,
      results: enrichedResults,
    };
  }

  private async attachSummaries(results: WebSearchResult[], summaryLimit: number): Promise<WebSearchResult[]> {
    const limit = clamp(summaryLimit, 1, 10);
    let remaining = limit;

    return Promise.all(
      results.map(async (result) => {
        if (remaining <= 0) {
          return result;
        }

        remaining -= 1;
        const fetchedSummary = await this.fetchPageSummary(result.url);
        return fetchedSummary ? { ...result, fetchedSummary } : result;
      }),
    );
  }

  private async fetchPageSummary(url: string): Promise<string | undefined> {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        return undefined;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType.includes("application/pdf") || contentType.includes("image/")) {
        return undefined;
      }

      const body = await response.text();
      return extractSearchPageSummary(body);
    } catch {
      return undefined;
    }
  }
}

export function parseSearchResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (isBlockedSearchResponse(engine, html)) {
    return [];
  }

  const parsers = [
    parseDuckDuckGoResults,
    parseBingResults,
    parseBraveResults,
    parseGoogleResults,
    parseYahooResults,
    parseYandexResults,
    parseBaiduResults,
    parseGenericAnchorResults,
  ];

  for (const parser of parsers) {
    const parsed = parser(engine, html, pageUrl, limit);
    if (parsed.length > 0) {
      return dedupeWebSearchResults(parsed, limit);
    }
  }

  return [];
}

function isBlockedSearchResponse(engine: WebSearchEngine, html: string): boolean {
  const normalized = html.toLowerCase();

  if (engine === "google") {
    return (
      normalized.includes("if you're having trouble accessing google search") ||
      normalized.includes("/httpservice/retry/enablejs") ||
      normalized.includes("id=\"yvlrue\"")
    );
  }

  if (engine === "yandex") {
    return (
      normalized.includes("<title>verification</title>") ||
      normalized.includes("checking your browser before redirecting to yandex.com") ||
      normalized.includes("/showcaptchafast?") ||
      normalized.includes("/checkcaptchafast?") ||
      normalized.includes("smart-captcha") ||
      normalized.includes("x-yandex-captcha")
    );
  }

  return false;
}

export function extractSearchPageSummary(html: string): string | undefined {
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
      const content =
        tag.match(/\bcontent="([^"]*)"/i)?.[1] ??
        tag.match(/\bcontent='([^']*)'/i)?.[1];
      const value = stripHtml(content ?? "");
      if (isUsefulSummaryText(value)) {
        return value;
      }
    }
  }
  return undefined;
}

function joinSummaryParts(parts: string[], maxParts: number): string {
  return parts
    .slice(0, maxParts)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseDuckDuckGoResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "duckduckgo") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1000}?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;
  for (const match of html.matchAll(blockRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    const snippet = stripHtml(match[3] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl)) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseBingResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "bing") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const blockMatch of html.matchAll(blockRegex)) {
    const block = blockMatch[1] ?? "";
    const headingMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
    if (!headingMatch) {
      continue;
    }

    const url = absoluteSearchResultUrl(headingMatch[1] ?? "", pageUrl);
    const title = stripHtml(headingMatch[2] ?? "");
    const snippet =
      stripHtml(block.match(/<div[^>]+class="[^"]*\bb_caption\b[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "") ||
      stripHtml(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl)) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseBraveResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "brave") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<a[^>]+href="([^"]+)"[^>]*data-type="web"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1200}?(?:<div[^>]+class="[^"]*(?:snippet|description)[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;
  for (const match of html.matchAll(blockRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    const snippet = stripHtml(match[3] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl)) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseGoogleResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "google") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<a[^>]+href="([^"]*\/url\?[^"]+|https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,800}?(?:<div[^>]*>([\s\S]*?)<\/div>)?/gi;
  for (const match of html.matchAll(blockRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    const snippet = stripHtml(match[3] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl) || title.length < 3) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseYahooResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "yahoo") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blocks = collectBlocksByStartTag(html, /<div[^>]+class="[^"]*\balgo-sr\b[^"]*"[^>]*>/gi);
  const candidates =
    blocks.length > 0
      ? blocks
      : [...html.matchAll(/<div[^>]+class="[^"]*\balgo\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)].map((match) => match[0]);

  for (const block of candidates) {
    const headingMatch =
      block.match(/<div[^>]+class="[^"]*\bcompTitle\b[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/i) ??
      block.match(/<a[^>]+href="([^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/i) ??
      block.match(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i);
    if (!headingMatch) {
      continue;
    }

    const url = absoluteSearchResultUrl(headingMatch[1] ?? "", pageUrl);
    const title = stripHtml(headingMatch[2] ?? "");
    const snippet =
      stripHtml(block.match(/<div[^>]+class="[^"]*\bcompText\b[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "") ||
      stripHtml(block.match(/<div[^>]+class="[^"]*\bcompText\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "") ||
      stripHtml(block.match(/<span[^>]+class="[^"]*(?:compText|lh-22)[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
      stripHtml(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl) || title.length < 3) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function parseYandexResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "yandex") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<li[^>]+class="[^"]*serp-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const blockMatch of html.matchAll(blockRegex)) {
    const block = blockMatch[1] ?? "";
    const headingMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!headingMatch) {
      continue;
    }
    const url = absoluteSearchResultUrl(headingMatch[1] ?? "", pageUrl);
    const title = stripHtml(headingMatch[2] ?? "");
    const snippet =
      stripHtml(block.match(/<div[^>]+class="[^"]*(?:OrganicTextContentSpan|organic__content-wrapper|organic__text|text-container)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "") ||
      stripHtml(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl) || title.length < 3) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function parseBaiduResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "baidu") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const headingRegex = /<h3[^>]*>\s*<a[^>]+href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>\s*<\/h3>/gi;
  for (const match of html.matchAll(headingRegex)) {
    const href = match[1] ?? "";
    const attrs = match[2] ?? "";
    const title = stripHtml(match[3] ?? "");
    const mu = attrs.match(/\bmu="([^"]+)"/i)?.[1];
    const url = absoluteSearchResultUrl(mu ?? href, pageUrl) ?? (mu ? absoluteSearchResultUrl(mu, pageUrl) : undefined);
    const tailStart = (match.index ?? 0) + match[0].length;
    const tail = html.slice(tailStart, tailStart + 1200);
    const snippet =
      stripHtml(tail.match(/<div[^>]+class="[^"]*(?:c-abstract|content-right_8Zs40)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "") ||
      stripHtml(tail.match(/<span[^>]+class="[^"]*(?:c-color-text|content-right_8Zs40)[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");

    if (!url || !isUsefulSearchResult(url, title, pageUrl) || title.length < 3) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function parseGenericAnchorResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const anchorRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl) || title.length < 3) {
      continue;
    }

    results.push({
      engine,
      title,
      url,
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function collectBlocksByStartTag(html: string, startRegex: RegExp): string[] {
  const matches = [...html.matchAll(startRegex)];
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}

function createSearchFetchError(
  engine: WebSearchEngine,
  label: string,
  searchUrl: string,
  query: string,
  error: unknown,
): MikaCliError {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "Error";
  const lowered = `${name} ${message}`.toLowerCase();
  const timedOut = lowered.includes("timeout") || lowered.includes("timed out") || lowered.includes("abort");

  if (engine === "baidu" && timedOut) {
    return new MikaCliError(
      "WEBSEARCH_ENGINE_UNREACHABLE",
      "Baidu did not respond before the request timed out. It may be blocked or unreachable from the current network.",
      {
        details: {
          engine,
          query,
          searchUrl,
          reason: message,
        },
        cause: error,
      },
    );
  }

  return new MikaCliError(
    "WEBSEARCH_ENGINE_UNREACHABLE",
    timedOut ? `${label} did not respond before the request timed out.` : `Unable to reach ${label}.`,
    {
      details: {
        engine,
        query,
        searchUrl,
        reason: message,
      },
      cause: error,
    },
  );
}

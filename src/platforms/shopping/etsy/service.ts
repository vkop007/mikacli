import { AutoCliError } from "../../../errors.js";
import { clamp, collapseWhitespace } from "../shared/helpers.js";

import type { AdapterActionResult } from "../../../types.js";

const DUCKDUCKGO_READABLE_PREFIX = "https://r.jina.ai/http://html.duckduckgo.com/html/?q=";
const ETSY_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface EtsySearchResult {
  listingId?: string;
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
}

interface EtsyShopInfo {
  shopName: string;
  url: string;
  description?: string;
  reviewCountText?: string;
}

export class EtsyAdapter {
  readonly platform = "etsy" as const;
  readonly displayName = "Etsy";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("ETSY_QUERY_REQUIRED", "Provide an Etsy query to search.");
    }

    const limit = clamp(input.limit ?? 5, 1, 25);
    const markdown = await this.fetchDuckDuckGoSiteSearch(`site:etsy.com/listing ${query}`);
    const results = parseEtsySearchResults(markdown).slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} Etsy discovery result${results.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        results,
      },
    };
  }

  async productInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = resolveEtsyProductTarget(input.target);
    const markdown = await this.fetchDuckDuckGoSiteSearch(resolved.searchQuery);
    const results = parseEtsySearchResults(markdown);
    const matched =
      results.find((entry) => resolved.listingId && entry.listingId === resolved.listingId) ??
      results.find((entry) => resolved.url && normalizeUrl(entry.url) === normalizeUrl(resolved.url)) ??
      results[0];

    const partialTitle = resolved.fallbackTitle ?? "Etsy listing";
    const listingId = matched?.listingId ?? resolved.listingId;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "product",
      message: matched
        ? `Loaded Etsy listing discovery for ${matched.title}.`
        : "Loaded a partial Etsy listing reference from the target. Direct Etsy page fetches are currently protected.",
      id: listingId,
      url: matched?.url ?? resolved.url,
      data: {
        title: matched?.title ?? partialTitle,
        description:
          matched?.description ??
          "Direct Etsy product fetches are anti-bot protected, so this result is based on public search discovery rather than the live listing page.",
        features: [
          listingId ? `listing id: ${listingId}` : undefined,
          matched?.publishedAt ? `indexed: ${matched.publishedAt}` : undefined,
          matched ? "source: public DuckDuckGo site search" : "source: target fallback",
        ].filter((value): value is string => typeof value === "string" && value.length > 0),
      },
    };
  }

  async storeInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = resolveEtsyShopTarget(input.target);
    const markdown = await this.fetchDuckDuckGoSiteSearch(`site:etsy.com/shop ${resolved.shopName}`);
    const results = parseEtsyShopResults(markdown);
    const matched =
      results.find((entry) => normalizeShopName(entry.shopName) === normalizeShopName(resolved.shopName)) ?? results[0];

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "shop",
      message: matched
        ? `Loaded Etsy shop discovery for ${matched.shopName}.`
        : "Loaded a partial Etsy shop reference from the target. Direct Etsy shop fetches are currently protected.",
      id: resolved.shopName,
      url: matched?.url ?? resolved.url,
      user: {
        id: resolved.shopName,
        username: resolved.shopName,
        displayName: matched?.shopName ?? resolved.shopName,
        profileUrl: matched?.url ?? resolved.url,
      },
      data: {
        title: matched?.shopName ?? resolved.shopName,
        description:
          matched?.description ??
          "Direct Etsy shop fetches are anti-bot protected, so this result is based on public search discovery rather than the live shop page.",
        reviewCountText: matched?.reviewCountText,
      },
    };
  }

  private async fetchDuckDuckGoSiteSearch(query: string): Promise<string> {
    const response = await fetch(`${DUCKDUCKGO_READABLE_PREFIX}${encodeURIComponent(query)}`, {
      headers: {
        "user-agent": ETSY_USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new AutoCliError("ETSY_DISCOVERY_FAILED", "Failed to load Etsy discovery results.", {
        details: {
          query,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return text;
  }
}

function parseEtsySearchResults(markdown: string): EtsySearchResult[] {
  const blocks = extractDuckDuckGoBlocks(markdown);
  const results: EtsySearchResult[] = [];

  for (const block of blocks) {
    const url = decodeDuckDuckGoUrl(block.url);
    if (!url || !url.includes("etsy.com/listing/")) {
      continue;
    }

    results.push({
      listingId: url.match(/\/listing\/(\d+)/i)?.[1],
      title: collapseWhitespace(block.title.replace(/\s+-\s+Etsy$/i, "")) ?? "Etsy listing",
      url,
      description: collapseWhitespace(block.description),
      publishedAt: collapseWhitespace(block.publishedAt),
    });
  }

  return results;
}

function parseEtsyShopResults(markdown: string): EtsyShopInfo[] {
  const blocks = extractDuckDuckGoBlocks(markdown);
  const reviewCounts = new Map<string, string>();
  const results: EtsyShopInfo[] = [];

  for (const block of blocks) {
    const url = decodeDuckDuckGoUrl(block.url);
    if (!url || !url.includes("etsy.com/shop/")) {
      continue;
    }

    const shopName = collapseWhitespace(
      url.match(/\/shop\/([^/?#]+)/i)?.[1] ?? block.title.replace(/\s+-\s+Etsy(?:\s+Canada)?$/i, ""),
    );
    if (!shopName) {
      continue;
    }

    if (url.includes("/reviews")) {
      const reviewCountText = collapseWhitespace(block.description?.match(/Read\s+[\d,]+\s+reviews/i)?.[0]);
      if (reviewCountText) {
        reviewCounts.set(normalizeShopName(shopName), reviewCountText);
      }
      continue;
    }

    results.push({
      shopName,
      url,
      description: collapseWhitespace(block.description),
      reviewCountText: undefined,
    });
  }

  return results.map((entry) => ({
    ...entry,
    reviewCountText: reviewCounts.get(normalizeShopName(entry.shopName)),
  }));
}

function extractDuckDuckGoBlocks(markdown: string): Array<{
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
}> {
  const lines = markdown.split("\n").map((line) => line.trim());
  const blocks: Array<{ title: string; url: string; description?: string; publishedAt?: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const titleMatch = lines[index]?.match(/^## \[(.+?)\]\((http[^)]+)\)$/);
    if (!titleMatch?.[1] || !titleMatch[2]) {
      continue;
    }

    const block: { title: string; url: string; description?: string; publishedAt?: string } = {
      title: collapseWhitespace(titleMatch[1]),
      url: titleMatch[2],
    };

    for (let cursor = index + 1; cursor < lines.length && cursor <= index + 4; cursor += 1) {
      const line = lines[cursor];
      if (!line) {
        continue;
      }
      if (line.startsWith("## ")) {
        break;
      }
      if (!block.publishedAt && /www\.etsy\.com\//i.test(line)) {
        block.publishedAt = line.match(/\b\d{4}-\d{2}-\d{2}T[0-9:.]+/)?.[0];
        continue;
      }
      if (
        !block.description &&
        /^\[[^\]]+]\(http:\/\/duckduckgo\.com\/l\/\?uddg=/i.test(line) &&
        !line.includes("[www.etsy.com/") &&
        !line.includes("[![Image")
      ) {
        block.description = line.replace(/^\[/, "").replace(/\]\(http:\/\/duckduckgo\.com\/l\/\?uddg=.*$/, "");
      }
    }

    blocks.push(block);
  }

  return blocks;
}

function resolveEtsyProductTarget(target: string): {
  searchQuery: string;
  listingId?: string;
  url?: string;
  fallbackTitle?: string;
} {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("ETSY_TARGET_REQUIRED", "Provide an Etsy listing URL, numeric listing ID, or search query.");
  }

  const urlMatch = trimmed.match(/etsy\.com\/listing\/(\d+)\/([^?#]+)/i);
  if (urlMatch?.[1]) {
    const fallbackTitle = (urlMatch[2] ?? urlMatch[1]).replace(/-/g, " ");
    return {
      searchQuery: `site:etsy.com/listing ${fallbackTitle}`,
      listingId: urlMatch[1],
      url: trimmed,
      fallbackTitle,
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      searchQuery: `site:etsy.com/listing ${trimmed}`,
      listingId: trimmed,
      fallbackTitle: `Etsy listing ${trimmed}`,
    };
  }

  return {
    searchQuery: `site:etsy.com/listing ${trimmed}`,
    fallbackTitle: trimmed,
  };
}

function resolveEtsyShopTarget(target: string): { shopName: string; url?: string } {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("ETSY_SHOP_REQUIRED", "Provide an Etsy shop URL or shop name.");
  }

  const urlMatch = trimmed.match(/etsy\.com\/shop\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return {
      shopName: decodeURIComponent(urlMatch[1]),
      url: trimmed,
    };
  }

  return {
    shopName: trimmed.replace(/^@/, ""),
  };
}

function decodeDuckDuckGoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const encoded = parsed.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : url;
  } catch {
    return url;
  }
}

function normalizeShopName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "").toLowerCase();
}

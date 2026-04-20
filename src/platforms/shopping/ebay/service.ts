import { MikaCliError } from "../../../errors.js";
import { clamp, collapseWhitespace } from "../shared/helpers.js";

import type { AdapterActionResult } from "../../../types.js";

const EBAY_ORIGIN = "https://www.ebay.com";
const READABLE_PROXY_PREFIX = "https://r.jina.ai/http://";
const EBAY_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface EbaySearchResult {
  itemId: string;
  title: string;
  url: string;
  imageUrl?: string;
  priceText?: string;
  availability?: string;
  seller?: string;
  soldText?: string;
  shippingText?: string;
  description?: string;
  sponsored?: boolean;
}

interface EbayProductInfo {
  itemId: string;
  title: string;
  url: string;
  priceText?: string;
  availability?: string;
  description?: string;
  features: string[];
}

interface EbaySellerInfo {
  sellerId: string;
  title: string;
  url: string;
  location?: string;
  memberSince?: string;
  positiveFeedbackText?: string;
  itemsSoldText?: string;
  followersText?: string;
  description?: string;
}

export class EbayAdapter {
  readonly platform = "ebay" as const;
  readonly displayName = "eBay";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("EBAY_QUERY_REQUIRED", "Provide an eBay query to search.");
    }

    const limit = clamp(input.limit ?? 5, 1, 25);
    const readable = await this.fetchReadableMarkdown(this.buildSearchUrl(query));
    const results = parseEbaySearchResults(readable).slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} eBay product${results.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        results,
      },
    };
  }

  async productInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = await this.resolveProductTarget(input.target);
    const readable = await this.fetchReadableMarkdown(resolved.url);
    const product = parseEbayProductInfo(readable, resolved.url, resolved.itemId);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "product",
      message: `Loaded eBay product ${product.itemId}.`,
      id: product.itemId,
      url: product.url,
      data: {
        title: product.title,
        priceText: product.priceText,
        availability: product.availability,
        description: product.description,
        features: product.features,
      },
    };
  }

  async storeInfo(input: { target: string }): Promise<AdapterActionResult> {
    const sellerId = resolveEbaySellerTarget(input.target);
    const url = `${EBAY_ORIGIN}/usr/${sellerId}`;
    const readable = await this.fetchReadableMarkdown(url);
    const seller = parseEbaySellerInfo(readable, url, sellerId);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "seller",
      message: `Loaded eBay seller ${seller.title}.`,
      id: seller.sellerId,
      url: seller.url,
      user: {
        id: seller.sellerId,
        username: seller.sellerId,
        displayName: seller.title,
        profileUrl: seller.url,
      },
      data: {
        title: seller.title,
        location: seller.location,
        memberSince: seller.memberSince,
        positiveFeedbackText: seller.positiveFeedbackText,
        itemsSoldText: seller.itemsSoldText,
        followersText: seller.followersText,
        description: seller.description,
      },
    };
  }

  async suggestions(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("EBAY_QUERY_REQUIRED", "Provide an eBay query to suggest.");
    }

    const url = new URL("https://autosug.ebay.com/autosug");
    url.searchParams.set("kwd", query);
    url.searchParams.set("_jgr", "1");
    url.searchParams.set("sId", "0");
    url.searchParams.set("_ex_kwd", query);
    url.searchParams.set("_es", "0");
    url.searchParams.set("_ec", "0");
    url.searchParams.set("_so", "0");
    url.searchParams.set("_dm", "0");
    url.searchParams.set("_nkw", query);
    url.searchParams.set("_pgn", "1");
    url.searchParams.set("_sasl", "");
    url.searchParams.set("_ipg", "200");

    const response = await fetch(url, {
      headers: {
        "user-agent": EBAY_USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("EBAY_SUGGESTIONS_FAILED", "eBay rejected the suggestions request.", {
        details: {
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const suggestions = parseEbaySuggestions(text).slice(0, clamp(input.limit ?? 5, 1, 25));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "suggest",
      message: `Loaded ${suggestions.length} eBay suggestion${suggestions.length === 1 ? "" : "s"}.`,
      data: {
        query,
        suggestions,
      },
    };
  }

  private buildSearchUrl(query: string): string {
    const url = new URL("/sch/i.html", EBAY_ORIGIN);
    url.searchParams.set("_nkw", query);
    return url.toString();
  }

  private async resolveProductTarget(target: string): Promise<{ itemId: string; url: string }> {
    const trimmed = target.trim();
    if (!trimmed) {
      throw new MikaCliError("EBAY_TARGET_REQUIRED", "Provide an eBay item URL, numeric item ID, or search query.");
    }

    const itemIdMatch = trimmed.match(/(?:ebay\.[^/]+\/itm(?:\/[^/?#]+)?\/|^)(\d{9,14})(?:[/?#]|$)/i);
    if (itemIdMatch?.[1]) {
      return {
        itemId: itemIdMatch[1],
        url: `${EBAY_ORIGIN}/itm/${itemIdMatch[1]}`,
      };
    }

    const results = parseEbaySearchResults(await this.fetchReadableMarkdown(this.buildSearchUrl(trimmed)));
    const first = results[0];
    if (!first) {
      throw new MikaCliError("EBAY_PRODUCT_NOT_FOUND", `eBay could not find a product for "${trimmed}".`);
    }

    return {
      itemId: first.itemId,
      url: first.url,
    };
  }

  private async fetchReadableMarkdown(sourceUrl: string): Promise<string> {
    const response = await fetch(`${READABLE_PROXY_PREFIX}${sourceUrl.replace(/^https?:\/\//, "")}`, {
      headers: {
        "user-agent": EBAY_USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("EBAY_REQUEST_FAILED", "Failed to load eBay's public page.", {
        details: {
          sourceUrl,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return text;
  }
}

function parseEbaySearchResults(markdown: string): EbaySearchResult[] {
  const lines = markdown.split("\n");
  const seen = new Set<string>();
  const results: EbaySearchResult[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.includes("www.ebay.com/itm/") || !line.includes("Opens in a new window or tab")) {
      continue;
    }

    const titleMatch = [...line.matchAll(/\[([^\]]+?) Opens in a new window or tab\]\((https:\/\/www\.ebay\.com\/itm\/[^)]+)\)/g)].at(-1);
    if (!titleMatch?.[1] || !titleMatch[2]) {
      continue;
    }

    const itemId = extractDigits(titleMatch[2]);
    if (!itemId || seen.has(itemId)) {
      continue;
    }

    const title = collapseWhitespace(titleMatch[1]);
    if (!title || /^shop on ebay$/i.test(title)) {
      continue;
    }

    seen.add(itemId);
    const imageUrl = line.match(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/)?.[1];
    const meta = line.slice((titleMatch.index ?? 0) + titleMatch[0].length).trim();
    results.push({
      itemId,
      title,
      url: `${EBAY_ORIGIN}/itm/${itemId}`,
      imageUrl,
      priceText: matchPriceText(meta),
      availability: matchFirst(meta, [
        /Brand New/i,
        /Open Box/i,
        /Used/i,
        /New New/i,
        /Excellent - Refurbished/i,
        /Manufacturer refurbished/i,
        /Certified - Refurbished/i,
        /For parts or not working/i,
      ]),
      seller: matchSeller(meta),
      soldText: meta.match(/\b[\d,.+Kk]+\s+sold\b/i)?.[0],
      shippingText: meta.match(/\bFree delivery\b|\bFree shipping\b|\+\s*\$[\d.,]+\s+delivery\b/i)?.[0],
      description: undefined,
      sponsored: /\bSponsored\b/i.test(meta),
    });
  }

  return results;
}

function parseEbayProductInfo(markdown: string, url: string, fallbackItemId: string): EbayProductInfo {
  const lines = markdown.split("\n").map((line) => line.trim());
  const title = collapseWhitespace(lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").replace(/\s+\|\s+eBay$/i, ""));
  if (!title) {
    throw new MikaCliError("EBAY_PRODUCT_PARSE_FAILED", "eBay loaded the item page, but MikaCLI could not parse the title.");
  }

  const sellerSectionIndex = lines.findIndex((line) => line.includes("Seller's other items"));
  const sellerSection = sellerSectionIndex >= 0 ? lines.slice(Math.max(0, sellerSectionIndex - 12), sellerSectionIndex + 20) : lines;
  const seller = collapseWhitespace(
    sellerSection
      .map((line) => line.match(/\[([^\]]+)]\(https:\/\/www\.ebay\.com\/str\//i)?.[1])
      .find((value) => value && value.length > 2 && !/seller's other items/i.test(value)),
  );
  const feedbackCount = collapseWhitespace(
    sellerSection.find((line) => /^\(\d[\d,]*\)$/.test(line))?.replace(/[()]/g, ""),
  );
  const positiveFeedbackText = collapseWhitespace(
    stripMarkdownLinks(sellerSection.find((line) => /\d+(?:\.\d+)?%\s+positive/i.test(line)) ?? ""),
  );
  const priceText = collapseWhitespace(
    sellerSection.find((line, index) => index >= 0 && /^(?:US\s*)?\$[\d,.]+/.test(line)),
  );
  const conditionIndex = lines.findIndex((line) => /^Condition:$/i.test(line));
  const availability = normalizeRepeatedWords(lines[conditionIndex >= 0 ? findNextNonEmpty(lines, conditionIndex) : -1]);
  const shippingIndex = lines.findIndex((line) => /^Shipping:$/i.test(line));
  const shipping = collapseWhitespace(lines[shippingIndex >= 0 ? findNextNonEmpty(lines, shippingIndex) : -1]);
  const location = collapseWhitespace(lines.find((line) => /^Located in:/i.test(line))?.replace(/^Located in:\s*/i, ""));
  const returnsIndex = lines.findIndex((line) => /^Returns:$/i.test(line));
  const returns = collapseWhitespace(lines[returnsIndex >= 0 ? findNextNonEmpty(lines, returnsIndex) : -1]);

  const features = [
    seller ? `seller: ${seller}${positiveFeedbackText ? ` (${positiveFeedbackText}${feedbackCount ? `, ${feedbackCount} feedback` : ""})` : ""}` : undefined,
    shipping ? `shipping: ${shipping}` : undefined,
    location ? `location: ${location}` : undefined,
    returns ? `returns: ${returns}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return {
    itemId: extractDigits(url) ?? fallbackItemId,
    title,
    url,
    priceText,
    availability,
    description: undefined,
    features,
  };
}

function parseEbaySellerInfo(markdown: string, url: string, fallbackSellerId: string): EbaySellerInfo {
  const lines = markdown.split("\n").map((line) => line.trim());
  const titleLine = lines.find((line) => /^#\s+\[.+]\(https:\/\/www\.ebay\.com\/usr\/.+\)$/i.test(line));
  const title = collapseWhitespace(
    titleLine?.match(/^#\s+\[([^\]]+)]/)?.[1] ??
      lines.find((line) => /^Title:\s+.+ on eBay$/i.test(line))?.replace(/^Title:\s+/i, "").replace(/\s+on eBay$/i, ""),
  );
  if (!title) {
    throw new MikaCliError("EBAY_SELLER_PARSE_FAILED", "eBay loaded the seller page, but MikaCLI could not parse the seller name.");
  }

  const itemsSoldText = collapseWhitespace(lines.find((line) => /\bitems sold\b/i.test(line)));
  const followersText = collapseWhitespace(lines.find((line) => /\bfollower[s]?\b/i.test(line)));
  const positiveFeedbackText = collapseWhitespace(
    stripMarkdownLinks(lines.find((line) => /\bpositive feedback\b/i.test(line)) ?? ""),
  );
  const locationMemberLine = collapseWhitespace(lines.find((line) => /^Location:/i.test(line)));
  const locationMatch = locationMemberLine.match(/^Location:(.+?)\s+Member since:(.+)$/i);
  const descriptionIndex = lines.findIndex((line) => /^##\s+About$/i.test(line));
  const description = collapseWhitespace(descriptionIndex >= 0 ? lines[findNextNonEmpty(lines, descriptionIndex)] : undefined);

  return {
    sellerId: fallbackSellerId,
    title,
    url,
    location: collapseWhitespace(locationMatch?.[1]),
    memberSince: collapseWhitespace(locationMatch?.[2]),
    positiveFeedbackText,
    itemsSoldText,
    followersText,
    description:
      description &&
      !/Use this space to tell other eBay members/i.test(description) &&
      description !== locationMemberLine
        ? description
        : undefined,
  };
}

function parseEbaySuggestions(payload: string): string[] {
  const jsonMatch = payload.match(/_do\((\{[\s\S]*\})\)\s*$/);
  if (!jsonMatch?.[1]) {
    throw new MikaCliError("EBAY_SUGGESTIONS_PARSE_FAILED", "eBay returned an unexpected suggestions payload.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[1]);
  } catch {
    throw new MikaCliError("EBAY_SUGGESTIONS_PARSE_FAILED", "eBay returned invalid suggestions JSON.");
  }

  const suggestions = (parsed as { res?: { sug?: unknown[] } }).res?.sug;
  return Array.isArray(suggestions) ? suggestions.filter((value): value is string => typeof value === "string") : [];
}

function resolveEbaySellerTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new MikaCliError("EBAY_SELLER_REQUIRED", "Provide an eBay seller URL or username.");
  }

  const urlMatch = trimmed.match(/ebay\.[^/]+\/usr\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return decodeURIComponent(urlMatch[1]);
  }

  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!/\s/.test(normalized)) {
    return normalized;
  }

  throw new MikaCliError("INVALID_TARGET", "Expected an eBay seller URL or username.", {
    details: { target },
  });
}

function findNextNonEmpty(lines: readonly string[], index: number): number {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (lines[cursor]?.trim().length) {
      return cursor;
    }
  }

  return -1;
}

function extractDigits(value: string): string | undefined {
  return value.match(/\b(\d{9,14})\b/)?.[1];
}

function matchPriceText(value: string): string | undefined {
  return collapseWhitespace(value.match(/(?:US\s*)?\$[\d,.]+(?:\s+to\s+\$[\d,.]+)?(?:\$\d[\d.,]+)?(?:\s+or Best Offer)?/i)?.[0]);
}

function matchSeller(value: string): string | undefined {
  return collapseWhitespace(value.match(/\b([a-z0-9._-]+)\s+\d+(?:\.\d+)?%\s+positive\b/i)?.[1]);
}

function matchFirst(value: string, patterns: readonly RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = value.match(pattern)?.[0];
    if (match) {
      return normalizeRepeatedWords(match);
    }
  }

  return undefined;
}

function normalizeRepeatedWords(value: string | undefined): string | undefined {
  const collapsed = collapseWhitespace(value);
  if (!collapsed) {
    return undefined;
  }

  const duplicateMatch = collapsed.match(/^(.+?)\s+\1$/i);
  return duplicateMatch?.[1] ? duplicateMatch[1] : collapsed;
}

function stripMarkdownLinks(value: string): string {
  return value.replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1");
}

import { AutoCliError } from "../../../errors.js";
import { decodeHtml, trimSummary } from "../shared/helpers.js";

import type { AdapterActionResult } from "../../../types.js";

type JustWatchType = "movie" | "show";

interface JustWatchOfferProperty {
  name?: string;
  value?: string | string[];
}

interface JustWatchOffer {
  price?: string | number;
  priceCurrency?: string;
  businessFunction?: string;
  offeredBy?: {
    name?: string;
  };
  eligibleRegion?: {
    name?: string;
  };
  additionalProperty?: JustWatchOfferProperty[];
}

interface JustWatchPotentialAction {
  "@type"?: string;
  target?: {
    urlTemplate?: string;
  };
  expectsAcceptanceOf?: JustWatchOffer;
}

interface JustWatchJsonLd {
  "@type"?: string;
  name?: string;
  description?: string;
  image?: string;
  genre?: string[];
  dateCreated?: string;
  duration?: string;
  sameAs?: string;
  aggregateRating?: {
    ratingValue?: string | number;
    ratingCount?: string | number;
  };
  actor?: Array<{ name?: string }>;
  director?: Array<{ name?: string }>;
  potentialAction?: JustWatchPotentialAction[];
}

interface JustWatchListItem {
  id: string;
  title: string;
  type: JustWatchType;
  url: string;
  imageUrl?: string;
}

interface ResolvedJustWatchTarget {
  country: string;
  type: JustWatchType;
  url: string;
}

const JUSTWATCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export class JustWatchAdapter {
  readonly platform = "justwatch" as const;
  readonly displayName = "JustWatch";

  async titleInfo(input: { target: string; country?: string; type?: string }): Promise<AdapterActionResult> {
    const resolved = resolveJustWatchTarget(input.target, input.country, input.type);
    const html = await fetchJustWatchHtml(resolved.url);
    const title = extractJustWatchMetadata(html);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded JustWatch title ${title.title}.`,
      id: toJustWatchId(resolved.country, resolved.type, resolved.url),
      url: resolved.url,
      data: {
        title,
      },
    };
  }

  async availability(input: { target: string; country?: string; type?: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = resolveJustWatchTarget(input.target, input.country, input.type);
    const html = await fetchJustWatchHtml(resolved.url);
    const title = extractJustWatchMetadata(html);
    const items = extractJustWatchOffers(html).slice(0, normalizeLimit(input.limit, 12, 50));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "availability",
      message: `Loaded ${items.length} JustWatch offer${items.length === 1 ? "" : "s"} for ${title.title}.`,
      id: toJustWatchId(resolved.country, resolved.type, resolved.url),
      url: resolved.url,
      data: {
        title: title.title,
        country: resolved.country,
        type: resolved.type,
        items,
      },
    };
  }

  async trending(input: { country?: string; type?: string; limit?: number }): Promise<AdapterActionResult> {
    const country = normalizeCountry(input.country);
    const type = normalizeType(input.type, "movie");
    const pagePath = type === "movie" ? "movies" : "tv-shows";
    const html = await fetchJustWatchHtml(`https://www.justwatch.com/${country}/${pagePath}?sort_by=trending_7_day`);
    const items = extractJustWatchListItems(html).filter((item) => item.type === type).slice(0, normalizeLimit(input.limit, 10, 50));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "trending",
      message: `Loaded ${items.length} trending JustWatch ${type}${items.length === 1 ? "" : "s"}.`,
      data: {
        country,
        type,
        items,
      },
    };
  }

  async latest(input: { country?: string; type?: string; limit?: number }): Promise<AdapterActionResult> {
    const country = normalizeCountry(input.country);
    const type = normalizeListType(input.type);
    const html = await fetchJustWatchHtml(`https://www.justwatch.com/${country}/new`);
    const items = extractJustWatchListItems(html)
      .filter((item) => (type === "all" ? true : item.type === type))
      .slice(0, normalizeLimit(input.limit, 10, 50));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "new",
      message: `Loaded ${items.length} new JustWatch title${items.length === 1 ? "" : "s"}.`,
      data: {
        country,
        type,
        items,
      },
    };
  }
}

async function fetchJustWatchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": JUSTWATCH_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new AutoCliError("JUSTWATCH_REQUEST_FAILED", "JustWatch request failed.", {
      details: {
        status: response.status,
        statusText: response.statusText,
        url,
      },
    });
  }

  return response.text();
}

function extractJustWatchMetadata(html: string): Record<string, unknown> {
  const jsonLd = extractJustWatchJsonLd(html);
  const year = typeof jsonLd.dateCreated === "string" ? Number.parseInt(jsonLd.dateCreated.slice(0, 4), 10) : undefined;

  return {
    title: decodeHtml(jsonLd.name ?? "Untitled"),
    year: Number.isFinite(year) ? year : undefined,
    type: jsonLd["@type"] === "TVSeries" ? "show" : "movie",
    score: normalizeNumber(jsonLd.aggregateRating?.ratingValue),
    ratings: normalizeNumber(jsonLd.aggregateRating?.ratingCount),
    runtime: normalizeDuration(jsonLd.duration),
    genres: jsonLd.genre?.map((value) => decodeHtml(value)).filter(Boolean),
    cast: jsonLd.actor?.map((person) => decodeHtml(person.name ?? "")).filter(Boolean),
    directors: jsonLd.director?.map((person) => decodeHtml(person.name ?? "")).filter(Boolean),
    summary: trimSummary(decodeHtml(jsonLd.description ?? ""), 500),
    imageUrl: jsonLd.image,
    sameAs: jsonLd.sameAs,
  };
}

function extractJustWatchOffers(html: string): Array<Record<string, unknown>> {
  const jsonLd = extractJustWatchJsonLd(html);
  const actions = Array.isArray(jsonLd.potentialAction) ? jsonLd.potentialAction : [];
  const items: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const action of actions) {
    const offer = action.expectsAcceptanceOf;
    if (!offer) {
      continue;
    }

    const provider = decodeHtml(offer.offeredBy?.name ?? "");
    if (!provider) {
      continue;
    }

    const kind = normalizeOfferKind(offer.businessFunction);
    const price = normalizeNumber(offer.price);
    const currency = offer.priceCurrency;
    const region = offer.eligibleRegion?.name;
    const properties = Array.isArray(offer.additionalProperty) ? offer.additionalProperty : [];
    const format = toStringProperty(findOfferProperty(properties, "videoFormat"));
    const audioLanguages = toStringArray(findOfferProperty(properties, "audioLanguage"));
    const subtitleLanguages = toStringArray(findOfferProperty(properties, "subtitleLanguages"));
    const watchUrl = action.target?.urlTemplate;
    const key = [provider, kind, price ?? "-", watchUrl ?? "-"].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    items.push({
      provider,
      kind,
      price,
      currency,
      format,
      audioLanguages,
      subtitleLanguages,
      region,
      watchUrl,
    });
  }

  return items;
}

function extractJustWatchListItems(html: string): JustWatchListItem[] {
  const matches = html.matchAll(
    /data-testid="titleItem"[^>]*data-title="([^"]+)"[\s\S]*?<a href="(\/([a-z]{2})\/(movie|tv-show)\/[^"]+)" class="title-list-grid__item--link"[\s\S]*?srcset="([^"]+)"/g,
  );
  const items: JustWatchListItem[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const title = decodeHtml(match[1] ?? "");
    const path = match[2] ?? "";
    const country = (match[3] ?? "us").toLowerCase();
    const type = match[4] === "tv-show" ? "show" : "movie";
    const imageUrl = match[5]?.split(",")[0]?.trim().split(" ")[0];
    if (!title || !path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    items.push({
      id: `${country}/${type}/${path.split("/").pop() ?? path}`,
      title,
      type,
      url: `https://www.justwatch.com${path}`,
      imageUrl,
    });
  }

  return items;
}

function extractJustWatchJsonLd(html: string): JustWatchJsonLd {
  const match = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    throw new AutoCliError("JUSTWATCH_PARSE_FAILED", "JustWatch returned a page, but the structured metadata block was missing.");
  }

  try {
    return JSON.parse(match[1]) as JustWatchJsonLd;
  } catch (error) {
    throw new AutoCliError("JUSTWATCH_PARSE_FAILED", "Failed to parse the JustWatch structured metadata block.", {
      cause: error,
    });
  }
}

function resolveJustWatchTarget(target: string, countryInput?: string, typeInput?: string): ResolvedJustWatchTarget {
  const normalized = target.trim();
  if (!normalized) {
    throw new AutoCliError("JUSTWATCH_TARGET_REQUIRED", "Provide a JustWatch title URL or slug like /us/movie/inception.");
  }

  const fullUrl = normalized.match(/^https?:\/\/(?:www\.)?justwatch\.com\/([a-z]{2})\/(movie|tv-show)\/([^/?#]+)/i);
  if (fullUrl) {
    const [, countryCode = "us", typeSlug = "movie", slug = ""] = fullUrl;
    return {
      country: countryCode.toLowerCase(),
      type: typeSlug === "tv-show" ? "show" : "movie",
      url: `https://www.justwatch.com/${countryCode.toLowerCase()}/${typeSlug}/${slug}`,
    };
  }

  const slugWithCountry = normalized.match(/^\/?([a-z]{2})\/(movie|tv-show)\/([^/?#]+)/i);
  if (slugWithCountry) {
    const [, countryCode = "us", typeSlug = "movie", slug = ""] = slugWithCountry;
    return {
      country: countryCode.toLowerCase(),
      type: typeSlug === "tv-show" ? "show" : "movie",
      url: `https://www.justwatch.com/${countryCode.toLowerCase()}/${typeSlug}/${slug}`,
    };
  }

  const shortSlug = normalized.match(/^\/?(movie|tv-show)\/([^/?#]+)/i);
  if (shortSlug) {
    const country = normalizeCountry(countryInput);
    return {
      country,
      type: shortSlug[1] === "tv-show" ? "show" : "movie",
      url: `https://www.justwatch.com/${country}/${shortSlug[1]}/${shortSlug[2]}`,
    };
  }

  if (!normalized.includes("/")) {
    throw new AutoCliError(
      "JUSTWATCH_TARGET_REQUIRED",
      "JustWatch needs a direct title URL or slug like /us/movie/inception because public query search is not stable enough yet.",
    );
  }

  throw new AutoCliError("JUSTWATCH_TARGET_REQUIRED", "Provide a valid JustWatch URL or slug like /us/movie/inception.");
}

function normalizeCountry(input: string | undefined): string {
  const country = (input?.trim() || "us").toLowerCase();
  if (!/^[a-z]{2}$/.test(country)) {
    throw new AutoCliError("JUSTWATCH_COUNTRY_INVALID", "JustWatch country must be a 2-letter code like us or in.");
  }
  return country;
}

function normalizeType(input: string | undefined, fallback: JustWatchType): JustWatchType {
  const value = input?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (value === "movie") {
    return "movie";
  }
  if (value === "show" || value === "tv" || value === "tv-show") {
    return "show";
  }
  throw new AutoCliError("JUSTWATCH_TYPE_INVALID", "JustWatch type must be movie or show.");
}

function normalizeListType(input: string | undefined): JustWatchType | "all" {
  const value = input?.trim().toLowerCase();
  if (!value || value === "all") {
    return "all";
  }
  return normalizeType(value, "movie");
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizeNumber(input: string | number | undefined): number | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }
  const parsed = typeof input === "number" ? input : Number.parseFloat(String(input));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDuration(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const match = input.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return input;
  }
  return [match[1] ? `${match[1]}h` : "", match[2] ? `${match[2]}m` : "", match[3] ? `${match[3]}s` : ""].filter(Boolean).join(" ");
}

function normalizeOfferKind(input: string | undefined): string {
  switch (input) {
    case "https://schema.org/ProvideService":
      return "stream";
    case "https://schema.org/RentAction":
      return "rent";
    case "https://schema.org/BuyAction":
      return "buy";
    default:
      return "other";
  }
}

function findOfferProperty(properties: JustWatchOfferProperty[], name: string): string | string[] | undefined {
  return properties.find((property) => property.name === name)?.value;
}

function toStringProperty(input: string | string[] | undefined): string | undefined {
  if (Array.isArray(input)) {
    return input[0] ? decodeHtml(input[0]) : undefined;
  }
  return typeof input === "string" ? decodeHtml(input) : undefined;
}

function toStringArray(input: string | string[] | undefined): string[] | undefined {
  if (Array.isArray(input)) {
    return input.map((value) => decodeHtml(value)).filter(Boolean);
  }
  if (typeof input === "string" && input.length > 0) {
    return [decodeHtml(input)];
  }
  return undefined;
}

function toJustWatchId(country: string, type: JustWatchType, url: string): string {
  return `${country}/${type}/${url.split("/").pop() ?? url}`;
}

export const justWatchAdapter = new JustWatchAdapter();

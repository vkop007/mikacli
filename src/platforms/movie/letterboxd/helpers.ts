import { XMLParser } from "fast-xml-parser";
import { AutoCliError } from "../../../errors.js";
import { decodeHtml, trimSummary } from "../shared/helpers.js";

const LETTERBOXD_ORIGIN = "https://letterboxd.com";
const RESERVED_PROFILE_SEGMENTS = new Set([
  "about",
  "api",
  "film",
  "films",
  "search",
  "signin",
  "sign-in",
  "lists",
  "show",
  "crew",
  "actor",
  "director",
  "studio",
  "year",
]);

const RSS_PARSER = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

type LetterboxdJsonLd = {
  "@type"?: string;
  name?: string;
  image?: string;
  url?: string;
  genre?: string[];
  aggregateRating?: {
    ratingValue?: number | string;
    ratingCount?: number | string;
    reviewCount?: number | string;
  };
  director?: Array<{ name?: string }>;
  actors?: Array<{ name?: string }>;
  productionCompany?: Array<{ name?: string }>;
  countryOfOrigin?: Array<{ name?: string }>;
  releasedEvent?: Array<{ startDate?: string }>;
};

export type LetterboxdSearchItem = {
  id: string;
  title: string;
  year?: number;
  type: "film";
  summary?: string;
  url: string;
};

export type LetterboxdTitle = {
  id: string;
  title: string;
  year?: number;
  type: "film";
  rating?: string;
  members?: string;
  popularity?: string;
  director?: string;
  genres?: string[];
  cast?: string[];
  studio?: string;
  country?: string;
  summary?: string;
  imageUrl?: string;
  url: string;
};

export type LetterboxdProfile = {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  favorites?: string;
  films?: string;
  lists?: string;
  followers?: string;
  memberSince?: string;
  url: string;
};

export type LetterboxdDiaryEntry = {
  id: string;
  title: string;
  year?: number;
  watchedDate?: string;
  rating?: string;
  publishedAt?: string;
  summary?: string;
  url: string;
};

export function normalizeLetterboxdFilmUrl(target: string): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith("letterboxd.com")) {
      return undefined;
    }
    const match = url.pathname.match(/^\/film\/([^/]+)\/?$/u);
    return match?.[1] ? buildLetterboxdFilmUrl(match[1]) : undefined;
  }

  if (/^(?:www\.)?letterboxd\.com\/film\/[^/\s]+\/?$/iu.test(trimmed)) {
    return normalizeLetterboxdFilmUrl(`https://${trimmed.replace(/^https?:\/\//iu, "")}`);
  }

  const pathMatch = trimmed.match(/^\/?film\/([^/\s]+)\/?$/iu);
  return pathMatch?.[1] ? buildLetterboxdFilmUrl(pathMatch[1]) : undefined;
}

export function buildLetterboxdFilmUrl(slug: string): string {
  return `${LETTERBOXD_ORIGIN}/film/${slug.replace(/^\/+|\/+$/gu, "")}/`;
}

export function extractLetterboxdFilmId(url: string): string | undefined {
  return normalizeLetterboxdFilmUrl(url)?.match(/\/film\/([^/]+)\//u)?.[1];
}

export function normalizeLetterboxdUsername(target: string): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith("letterboxd.com")) {
      return undefined;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const username = segments[0];
    if (!username || RESERVED_PROFILE_SEGMENTS.has(username.toLowerCase())) {
      return undefined;
    }
    return username;
  }

  return /^@?[A-Za-z0-9_-]+$/u.test(trimmed) ? trimmed.replace(/^@/u, "") : undefined;
}

export function buildLetterboxdProfileUrl(username: string): string {
  return `${LETTERBOXD_ORIGIN}/${username.replace(/^@/u, "").trim()}/`;
}

export function buildLetterboxdDiaryUrl(username: string): string {
  return `${buildLetterboxdProfileUrl(username)}rss/`;
}

export function parseLetterboxdFilmPage(html: string, url: string): LetterboxdTitle {
  const jsonLd = extractJsonLd(html);
  const titleInfo = parseTitleFromMeta(extractMetaContent(html, "og:title") ?? jsonLd?.name ?? "");
  const title = titleInfo.title.trim();
  if (!title) {
    throw new AutoCliError("LETTERBOXD_TITLE_PARSE_FAILED", "Letterboxd returned a film page, but the title could not be parsed.", {
      details: {
        url,
      },
    });
  }

  const aggregateRating = jsonLd?.aggregateRating;
  const directorNames = (jsonLd?.director ?? []).map((entry) => decodeHtml(entry.name ?? "")).filter(Boolean);
  const actorNames = (jsonLd?.actors ?? []).map((entry) => decodeHtml(entry.name ?? "")).filter(Boolean);
  const studios = (jsonLd?.productionCompany ?? []).map((entry) => decodeHtml(entry.name ?? "")).filter(Boolean);
  const countries = (jsonLd?.countryOfOrigin ?? []).map((entry) => decodeHtml(entry.name ?? "")).filter(Boolean);
  const year = titleInfo.year ?? parseYearFromReleasedEvent(jsonLd?.releasedEvent);
  const filmId = extractLetterboxdFilmId(url) ?? title.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  const ratingValue = normalizeNumericString(aggregateRating?.ratingValue);
  const ratingsCount = normalizeNumericValue(aggregateRating?.ratingCount);
  const reviewCount = normalizeNumericValue(aggregateRating?.reviewCount);

  return {
    id: filmId,
    title,
    year,
    type: "film",
    rating: ratingValue ? `${ratingValue} / 5` : undefined,
    members: ratingsCount ? `${formatNumber(ratingsCount)} ratings` : undefined,
    popularity: reviewCount ? `${formatNumber(reviewCount)} reviews` : undefined,
    director: directorNames.length > 0 ? directorNames.slice(0, 3).join(", ") : undefined,
    genres: (jsonLd?.genre ?? []).map((entry) => decodeHtml(entry)).filter(Boolean),
    cast: actorNames.slice(0, 8),
    studio: studios.length > 0 ? studios.slice(0, 3).join(", ") : undefined,
    country: countries.length > 0 ? countries.join(", ") : undefined,
    summary: trimSummary(decodeHtml(extractMetaContent(html, "description") ?? ""), 500),
    imageUrl: jsonLd?.image ?? extractMetaContent(html, "og:image") ?? undefined,
    url,
  };
}

export function parseLetterboxdProfilePage(html: string, url: string): LetterboxdProfile {
  const username = normalizeLetterboxdUsername(url);
  if (!username) {
    throw new AutoCliError("LETTERBOXD_PROFILE_PARSE_FAILED", "Letterboxd returned a profile page, but the username could not be parsed.", {
      details: {
        url,
      },
    });
  }

  const description = decodeHtml(extractMetaContent(html, "description") ?? "");
  const displayNameRaw = decodeHtml(extractMetaContent(html, "og:title") ?? username);
  const displayName = displayNameRaw.replace(/[’']s profile$/iu, "").trim() || username;

  return {
    id: username,
    username,
    displayName,
    bio: matchDescriptionSection(description, /Bio:\s*(.*?)\s*Letterboxd member since/iu),
    favorites: matchDescriptionSection(description, /Favorites:\s*(.*?)\.\s*Bio:/iu),
    films: extractProfileStat(html, username, "films"),
    lists: extractProfileStat(html, username, "lists"),
    followers: extractProfileStat(html, username, "followers"),
    memberSince: description.match(/Letterboxd member since ([^.]+)\./iu)?.[1]?.trim(),
    url: buildLetterboxdProfileUrl(username),
  };
}

export function parseLetterboxdDiaryFeed(xml: string, limit: number): LetterboxdDiaryEntry[] {
  const parsed = RSS_PARSER.parse(xml) as {
    rss?: {
      channel?: {
        item?: Array<Record<string, string>> | Record<string, string>;
      };
    };
  };

  const rawItems = parsed.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return items
    .filter((item) => typeof item["letterboxd:filmTitle"] === "string")
    .slice(0, limit)
    .map((item) => {
    const filmTitle = decodeHtml(item["letterboxd:filmTitle"] ?? item.title ?? "Untitled");
    const filmYear = normalizeInteger(item["letterboxd:filmYear"]);
    const rating = normalizeNumericString(item["letterboxd:memberRating"]);
      return {
        id: String(item.guid ?? item.link ?? filmTitle),
        title: filmTitle,
        year: filmYear,
        watchedDate: item["letterboxd:watchedDate"] || undefined,
        rating: rating ? `${rating} / 5` : undefined,
        publishedAt: item.pubDate || undefined,
        summary: trimSummary(decodeHtml(item.description ?? ""), 500),
        url: item.link ?? "",
      };
    });
}

function extractJsonLd(html: string): LetterboxdJsonLd | undefined {
  const marker = '<script type="application/ld+json">';
  const start = html.indexOf(marker);
  if (start < 0) {
    return undefined;
  }

  const contentStart = start + marker.length;
  const end = html.indexOf("</script>", contentStart);
  if (end < 0) {
    return undefined;
  }

  let raw = html.slice(contentStart, end).trim();
  const cdataOpen = "/* <![CDATA[" + " */";
  const cdataClose = "/* ]]>" + " */";
  if (raw.startsWith(cdataOpen)) {
    raw = raw.slice(cdataOpen.length).trim();
  }
  if (raw.endsWith(cdataClose)) {
    raw = raw.slice(0, -cdataClose.length).trim();
  }

  try {
    return JSON.parse(raw) as LetterboxdJsonLd;
  } catch {
    return undefined;
  }
}

function extractMetaContent(html: string, key: string): string | undefined {
  const escaped = escapeRegex(key);
  const propertyMatch = html.match(new RegExp(`<meta[^>]+property="${escaped}"[^>]+content="([^"]*)"`, "iu"));
  if (propertyMatch?.[1]) {
    return propertyMatch[1];
  }

  const nameMatch = html.match(new RegExp(`<meta[^>]+name="${escaped}"[^>]+content="([^"]*)"`, "iu"));
  return nameMatch?.[1];
}

function parseTitleFromMeta(value: string): { title: string; year?: number } {
  const decoded = decodeHtml(value);
  const match = decoded.match(/^(.*?)(?:\s+\((\d{4})\))?$/u);
  if (!match) {
    return { title: decoded };
  }

  return {
    title: match[1]?.trim() ?? decoded,
    year: normalizeInteger(match[2]),
  };
}

function parseYearFromReleasedEvent(events: Array<{ startDate?: string }> | undefined): number | undefined {
  for (const event of events ?? []) {
    const year = normalizeInteger(event.startDate?.slice(0, 4));
    if (year) {
      return year;
    }
  }
  return undefined;
}

function extractProfileStat(html: string, username: string, section: "films" | "lists" | "followers"): string | undefined {
  const match = html.match(
    new RegExp(`href="/${escapeRegex(username)}/${section}/"[^>]*>(?:<span class="value">)?([^<]+)`, "iu"),
  );
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function matchDescriptionSection(value: string, pattern: RegExp): string | undefined {
  const match = value.match(pattern)?.[1]?.trim();
  return match ? trimSummary(match, 700) : undefined;
}

function normalizeInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeNumericValue(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeNumericString(value: string | number | undefined): string | undefined {
  const parsed = normalizeNumericValue(value);
  return parsed === undefined ? undefined : Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2).replace(/\.?0+$/u, "");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/gu, "\\$&");
}

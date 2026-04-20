import { MikaCliError } from "../../../errors.js";

export type BandcampSearchType = "artist" | "album" | "track" | "all";

export function parseBandcampSearchType(value: string): BandcampSearchType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "artist" || normalized === "album" || normalized === "track" || normalized === "all") {
    return normalized;
  }

  throw new MikaCliError("BANDCAMP_SEARCH_TYPE_INVALID", "Bandcamp search type must be one of: artist, album, track, or all.", {
    details: {
      value,
    },
  });
}

export function parseBandcampLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MikaCliError("BANDCAMP_LIMIT_INVALID", "Bandcamp limit must be a positive integer.", {
      details: {
        value,
      },
    });
  }

  return parsed;
}

export function normalizeBandcampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

export function decodeBandcampHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

export function trimBandcampPreview(value: string | undefined, max = 220): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}…` : normalized;
}

export function normalizeBandcampUrl(target: string): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return sanitizeBandcampUrl(trimmed);
  }

  if (/^(?:www\.)?[a-z0-9-]+\.bandcamp\.com(?:\/[^\s]*)?$/i.test(trimmed)) {
    return sanitizeBandcampUrl(`https://${trimmed.replace(/^https?:\/\//i, "")}`);
  }

  return undefined;
}

export function sanitizeBandcampUrl(url: string): string {
  const parsed = new URL(url.replace(/^http:\/\//i, "https://"));
  parsed.search = "";
  parsed.hash = "";

  const normalized = parsed.toString();
  if (parsed.pathname === "/" || parsed.pathname.length === 0) {
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }

  return normalized.replace(/\/$/, "");
}

export function toBandcampReadableUrl(url: string): string {
  return `https://r.jina.ai/http://${sanitizeBandcampUrl(url).replace(/^https?:\/\//i, "")}`;
}

export function resolveBandcampArtistUrl(target: string): string {
  const url = normalizeBandcampUrl(target);
  if (!url) {
    throw new MikaCliError("BANDCAMP_ARTIST_URL_INVALID", "Expected a Bandcamp artist URL.", {
      details: {
        target,
      },
    });
  }

  const parsed = new URL(url);
  parsed.pathname = "/music";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function stripMarkdownLinks(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

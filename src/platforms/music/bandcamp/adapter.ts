import { MikaCliError } from "../../../errors.js";
import {
  decodeBandcampHtml,
  normalizeBandcampLimit,
  normalizeBandcampUrl,
  resolveBandcampArtistUrl,
  sanitizeBandcampUrl,
  stripMarkdownLinks,
  toBandcampReadableUrl,
  trimBandcampPreview,
} from "./helpers.js";

import type { AdapterActionResult } from "../../../types.js";
import type { BandcampSearchType } from "./helpers.js";

type BandcampEntityType = Exclude<BandcampSearchType, "all">;

interface BandcampSearchResult {
  id: string;
  type: BandcampEntityType;
  title: string;
  subtitle?: string;
  detail?: string;
  url: string;
}

interface BandcampTrackListItem {
  title: string;
  duration?: string;
  url?: string;
}

const BANDCAMP_SEARCH_URL = "https://bandcamp.com/search";
const BANDCAMP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export class BandcampAdapter {
  readonly platform = "bandcamp" as const;
  readonly displayName = "Bandcamp";

  async search(input: { query: string; type?: BandcampSearchType; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("BANDCAMP_QUERY_REQUIRED", "Provide a Bandcamp query to search.");
    }

    const limit = normalizeBandcampLimit(input.limit, 5, 25);
    const type = input.type ?? "all";
    const results = (await this.fetchSearchResults(query))
      .filter((item) => (type === "all" ? true : item.type === type))
      .slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} Bandcamp result${results.length === 1 ? "" : "s"}.`,
      data: {
        query,
        type,
        results,
      },
    };
  }

  async albumInfo(input: { target: string }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("BANDCAMP_TARGET_REQUIRED", "Provide a Bandcamp album URL or search query.");
    }

    const url = await this.resolveResourceUrl(target, "album");
    const markdown = await this.fetchReadableMarkdown(url);
    const album = parseBandcampAlbum(markdown, url);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "album",
      message: `Loaded Bandcamp album ${album.title}.`,
      id: String(album.id ?? url),
      url,
      data: album,
    };
  }

  async trackInfo(input: { target: string }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("BANDCAMP_TARGET_REQUIRED", "Provide a Bandcamp track URL or search query.");
    }

    const url = await this.resolveResourceUrl(target, "track");
    const markdown = await this.fetchReadableMarkdown(url);
    const track = parseBandcampTrack(markdown, url);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "track",
      message: `Loaded Bandcamp track ${track.title}.`,
      id: String(track.id ?? url),
      url,
      data: track,
    };
  }

  async artistInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("BANDCAMP_TARGET_REQUIRED", "Provide a Bandcamp artist URL or search query.");
    }

    const limit = normalizeBandcampLimit(input.limit, 10, 50);
    const searchHit = normalizeBandcampUrl(target) ? undefined : (await this.fetchSearchResults(target)).find((item) => item.type === "artist");
    const url = normalizeBandcampUrl(target) ? resolveBandcampArtistUrl(target) : resolveBandcampArtistUrl(searchHit?.url ?? target);
    const markdown = await this.fetchReadableMarkdown(url);
    const artist = parseBandcampArtist(markdown, url, limit, searchHit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "artist",
      message: `Loaded Bandcamp artist ${artist.title}.`,
      id: String(artist.id ?? url),
      url,
      data: artist,
    };
  }

  private async fetchSearchResults(query: string): Promise<BandcampSearchResult[]> {
    const url = `${BANDCAMP_SEARCH_URL}?q=${encodeURIComponent(query)}`;
    const html = await this.fetchHtml(url);
    return parseBandcampSearchResults(html);
  }

  private async resolveResourceUrl(target: string, type: BandcampEntityType): Promise<string> {
    const normalizedUrl = normalizeBandcampUrl(target);
    if (normalizedUrl) {
      if (type === "artist") {
        return resolveBandcampArtistUrl(normalizedUrl);
      }
      if (type === "album" && /\/album\//i.test(normalizedUrl)) {
        return sanitizeBandcampUrl(normalizedUrl);
      }
      if (type === "track" && /\/track\//i.test(normalizedUrl)) {
        return sanitizeBandcampUrl(normalizedUrl);
      }
    }

    const match = (await this.fetchSearchResults(target)).find((item) => item.type === type);
    if (!match) {
      throw new MikaCliError("BANDCAMP_RESULT_NOT_FOUND", `Bandcamp could not find a matching ${type}.`, {
        details: {
          target,
          type,
        },
      });
    }

    return type === "artist" ? resolveBandcampArtistUrl(match.url) : sanitizeBandcampUrl(match.url);
  }

  private async fetchHtml(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "user-agent": BANDCAMP_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      throw new MikaCliError("BANDCAMP_REQUEST_FAILED", "Failed to load Bandcamp.", {
        cause: error,
        details: {
          url,
        },
      });
    }

    if (!response.ok) {
      throw new MikaCliError("BANDCAMP_REQUEST_FAILED", "Bandcamp request failed.", {
        details: {
          url,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return response.text();
  }

  private async fetchReadableMarkdown(url: string): Promise<string> {
    const readableUrl = toBandcampReadableUrl(url);
    let response: Response;
    try {
      response = await fetch(readableUrl, {
        headers: {
          "user-agent": BANDCAMP_USER_AGENT,
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      throw new MikaCliError("BANDCAMP_READABLE_FAILED", "Failed to load the readable Bandcamp page.", {
        cause: error,
        details: {
          url,
        },
      });
    }

    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("BANDCAMP_READABLE_FAILED", "Bandcamp readable page request failed.", {
        details: {
          url,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return text;
  }
}

function parseBandcampSearchResults(html: string): BandcampSearchResult[] {
  const blocks = html.match(/<li class="searchresult data-search"[\s\S]*?<\/li>/g) ?? [];
  const results: BandcampSearchResult[] = [];

  for (const block of blocks) {
    const typeText = extractSearchText(block, /<div class="itemtype">\s*([\s\S]*?)\s*<\/div>/i);
    const type = normalizeBandcampResultType(typeText);
    if (!type) {
      continue;
    }

    const headingMatch = block.match(/<div class="heading">\s*<a [^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    const title = decodeBandcampHtml(headingMatch?.[2] ?? "");
    const rawUrl = decodeBandcampHtml(headingMatch?.[1] ?? "") || extractSearchText(block, /<div class="itemurl">\s*<a [^>]*href="([^"]+)"/i);
    if (!title || !rawUrl) {
      continue;
    }

    const url = sanitizeSearchResultUrl(rawUrl);
    const subtitle = extractSearchText(block, /<div class="subhead">\s*([\s\S]*?)\s*<\/div>/i);
    const detailParts = [
      extractSearchText(block, /<div class="length">\s*([\s\S]*?)\s*<\/div>/i),
      extractSearchText(block, /<div class="released">\s*([\s\S]*?)\s*<\/div>/i),
      extractSearchText(block, /<div class="genre">\s*genre:\s*([\s\S]*?)\s*<\/div>/i),
    ].filter((value): value is string => Boolean(value && value.length > 0));

    results.push({
      id: extractSearchText(block, /data-search="[^"]*&quot;id&quot;:(\d+)/i) ?? url,
      type,
      title,
      subtitle: subtitle || undefined,
      detail: detailParts.join(" • ") || undefined,
      url,
    });
  }

  return dedupeByUrl(results);
}

function parseBandcampAlbum(markdown: string, url: string): Record<string, unknown> {
  const title = extractMarkdownLine(markdown, /^##\s+(.+)$/m) ?? extractReadableTitle(markdown) ?? "Untitled album";
  const artistMatch = markdown.match(/^### by \[([^\]]+)\]\((https?:\/\/[^)]+)\)/m);
  const tracks = extractBandcampTracks(markdown);
  const priceMatch = markdown.match(/Buy Digital Album \$([0-9.]+)\s+([A-Z]{3})/i) ?? markdown.match(/Buy Album \$([0-9.]+)\s+([A-Z]{3})/i);
  const releaseDate = markdown.match(/\breleased ([A-Za-z]+ \d{1,2}, \d{4})/i)?.[1];

  return {
    id: extractBandcampIdFromUrl(url),
    title,
    artist: artistMatch?.[1],
    artistUrl: artistMatch?.[2],
    releaseDate,
    price: priceMatch ? `${priceMatch[1]} ${priceMatch[2]}` : undefined,
    tags: extractBandcampTags(markdown),
    tracks,
  };
}

function parseBandcampTrack(markdown: string, url: string): Record<string, unknown> {
  const title = extractMarkdownLine(markdown, /^##\s+(.+)$/m) ?? extractReadableTitle(markdown) ?? "Untitled track";
  const fromMatch = markdown.match(/^### from \[([^\]]+)\]\((https?:\/\/[^)]+)\) by \[([^\]]+)\]\((https?:\/\/[^)]+)\)/m);
  const priceMatch = markdown.match(/Buy Digital Track \$([0-9.]+)\s+([A-Z]{3})/i) ?? markdown.match(/Buy Track \$([0-9.]+)\s+([A-Z]{3})/i);
  const releaseDate = markdown.match(/track released ([A-Za-z]+ \d{1,2}, \d{4})/i)?.[1];
  const duration = markdown.match(/00:00 \/ (\d{2}:\d{2}(?::\d{2})?)/)?.[1];

  return {
    id: extractBandcampIdFromUrl(url),
    title,
    album: fromMatch?.[1],
    albumUrl: fromMatch?.[2],
    artist: fromMatch?.[3],
    artistUrl: fromMatch?.[4],
    duration,
    releaseDate,
    price: priceMatch ? `${priceMatch[1]} ${priceMatch[2]}` : undefined,
    tags: extractBandcampTags(markdown),
  };
}

function parseBandcampArtist(
  markdown: string,
  url: string,
  limit: number,
  searchHit?: BandcampSearchResult,
): Record<string, unknown> {
  const title = extractMarkdownLine(markdown, /^# Music \| (.+)$/m) ?? extractReadableTitle(markdown) ?? searchHit?.title ?? "Unknown artist";
  const aboutBlock = markdown.split("### about")[1] ?? "";
  const aboutLines = aboutBlock
    .split("\n")
    .map((line) => stripMarkdownLinks(line).trim())
    .filter(Boolean);
  const aboutLine = aboutLines[0];
  const websiteMatch = aboutBlock.match(/\[\s*([^\]]+)\s*]\((https?:\/\/(?![^)]*bandcamp\.com)[^)]+)\)/i);
  const location =
    aboutLine && aboutLine.toLowerCase().startsWith(title.toLowerCase()) ? trimBandcampPreview(aboutLine.slice(title.length).trim(), 120) : trimBandcampPreview(aboutLine, 120);
  const website = sanitizeBandcampWebsite(websiteMatch?.[2]);

  return {
    id: extractBandcampIdFromUrl(url),
    title,
    location: location || searchHit?.subtitle,
    genre: searchHit?.detail?.split(" • ").at(-1),
    website,
    releases: extractBandcampArtistReleases(markdown).slice(0, limit),
  };
}

function extractBandcampTracks(markdown: string): BandcampTrackListItem[] {
  const tracks: BandcampTrackListItem[] = [];
  const pattern = /(?:^|\n)\[\]\((?:https?:\/\/[^)]+)\)(\d+)\.\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s+(\d{2}:\d{2}(?::\d{2})?)/g;
  for (const match of markdown.matchAll(pattern)) {
    const title = match[2]?.trim();
    if (!title) {
      continue;
    }

    tracks.push({
      title,
      duration: match[4]?.trim() || undefined,
      url: match[3]?.trim() || undefined,
    });
  }

  return tracks;
}

function extractBandcampArtistReleases(markdown: string): Array<Record<string, unknown>> {
  const releases: Array<Record<string, unknown>> = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\d+\.\s+\[(?:!\[Image [^\]]*]\([^)]+\)\s*)?(.+)\]\((https?:\/\/[^)]+\/album\/[^)]+)\)$/);
    if (!match?.[1] || !match[2]) {
      continue;
    }

    const content = stripMarkdownLinks(match[1]).trim();
    const detailMatch = content.match(/(.+?)\s+([A-Z][a-z]{2}\s+\d{4})$/);
    releases.push({
      title: (detailMatch?.[1] ?? content).trim(),
      detail: detailMatch?.[2]?.trim(),
      url: match[2],
    });
  }

  return releases;
}

function extractBandcampTags(markdown: string): string[] | undefined {
  const tagsSection = markdown.split("### Tags")[1] ?? markdown.split("### tags")[1] ?? "";
  const tags = Array.from(tagsSection.matchAll(/\[([^\]]+)\]\(https?:\/\/bandcamp\.com\/discover\/[^)]+\)/g), (match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));

  return tags.length > 0 ? dedupeStrings(tags) : undefined;
}

function extractReadableTitle(markdown: string): string | undefined {
  const match = markdown.match(/^Title:\s*(.+)$/m);
  if (!match?.[1]) {
    return undefined;
  }

  return match[1].split(", by ")[0]?.trim();
}

function extractMarkdownLine(markdown: string, pattern: RegExp): string | undefined {
  const match = markdown.match(pattern);
  return match?.[1]?.trim();
}

function extractSearchText(block: string, pattern: RegExp): string | undefined {
  const match = block.match(pattern);
  return match?.[1] ? decodeBandcampHtml(match[1]) : undefined;
}

function normalizeBandcampResultType(typeText: string | undefined): BandcampEntityType | undefined {
  const normalized = typeText?.trim().toLowerCase();
  if (normalized === "artist" || normalized === "album" || normalized === "track") {
    return normalized;
  }

  return undefined;
}

function sanitizeSearchResultUrl(url: string): string {
  const normalized = sanitizeBandcampUrl(url);
  const parsed = new URL(normalized);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, parsed.pathname === "/" ? "/" : "");
}

function extractBandcampIdFromUrl(url: string): string {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  if (!lastSegment || lastSegment === "music") {
    const [subdomain] = parsed.hostname.split(".");
    return subdomain || parsed.hostname;
  }

  return lastSegment;
}

function sanitizeBandcampWebsite(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return undefined;
  }

  if (/\.(?:png|jpe?g|webp|gif|svg)(?:\?|$)/i.test(normalized)) {
    return undefined;
  }

  if (/\.bcbits\.com\//i.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    if (seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    deduped.push(item);
  }
  return deduped;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export const bandcampAdapter = new BandcampAdapter();

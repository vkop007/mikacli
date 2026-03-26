import { AutoCliError } from "../../../errors.js";
import type { SpotifyEntityType } from "../../../utils/targets.js";

export interface SpotifyImageSource {
  url?: string;
  width?: number | null;
  height?: number | null;
}

interface SpotifyDateParts {
  year?: number;
  month?: number;
  day?: number;
}

export function extractSpotifyScriptPayload<T>(html: string, scriptId: string): T {
  const escapedId = scriptId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<script id="${escapedId}" type="text/plain">([\\s\\S]*?)</script>`, "i"));

  if (!match?.[1]) {
    throw new AutoCliError("SPOTIFY_PAGE_PARSE_FAILED", `Spotify page payload "${scriptId}" was not found.`);
  }

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    return JSON.parse(decoded) as T;
  } catch (error) {
    throw new AutoCliError("SPOTIFY_PAGE_PARSE_FAILED", `Spotify page payload "${scriptId}" could not be decoded.`, {
      cause: error,
    });
  }
}

export function pickSpotifyImageUrl(
  sources?: readonly SpotifyImageSource[] | null,
  preferredWidth = 640,
): string | undefined {
  if (!sources || sources.length === 0) {
    return undefined;
  }

  const withUrls = sources.filter((source): source is SpotifyImageSource & { url: string } => typeof source.url === "string");
  if (withUrls.length === 0) {
    return undefined;
  }

  const exact = withUrls.find((source) => source.width === preferredWidth);
  if (exact?.url) {
    return exact.url;
  }

  const sorted = [...withUrls].sort((left, right) => {
    const leftWidth = typeof left.width === "number" ? left.width : 0;
    const rightWidth = typeof right.width === "number" ? right.width : 0;
    return rightWidth - leftWidth;
  });

  return sorted[0]?.url;
}

export function spotifyUriToUrl(uri?: string): string | undefined {
  if (!uri) {
    return undefined;
  }

  const match = uri.match(/^spotify:(track|album|artist|playlist|user):(.+)$/i);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  const type = match[1].toLowerCase();
  return `https://open.spotify.com/${type}/${match[2]}`;
}

export function buildSpotifyEntityUrl(type: SpotifyEntityType, id: string): string {
  return `https://open.spotify.com/${type}/${id}`;
}

export function formatSpotifyDuration(totalMilliseconds?: number): string | undefined {
  if (!Number.isFinite(totalMilliseconds) || !totalMilliseconds || totalMilliseconds <= 0) {
    return undefined;
  }

  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatSpotifyDate(date?: SpotifyDateParts | null): string | undefined {
  if (!date?.year) {
    return undefined;
  }

  if (date.month && date.day) {
    return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  }

  if (date.month) {
    return `${date.year}-${String(date.month).padStart(2, "0")}`;
  }

  return String(date.year);
}

export function cleanSpotifyText(text?: string | null): string | undefined {
  if (typeof text !== "string") {
    return undefined;
  }

  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

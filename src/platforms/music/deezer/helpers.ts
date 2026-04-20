import { MikaCliError } from "../../../errors.js";

export type DeezerSearchType = "track" | "album" | "artist" | "playlist" | "all";
export type DeezerEntityKind = Exclude<DeezerSearchType, "all">;

export function parseDeezerSearchType(value: string): DeezerSearchType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "track" || normalized === "album" || normalized === "artist" || normalized === "playlist" || normalized === "all") {
    return normalized;
  }

  throw new MikaCliError("DEEZER_SEARCH_TYPE_INVALID", "Deezer search type must be one of: track, album, artist, playlist, or all.", {
    details: {
      value,
    },
  });
}

export function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MikaCliError("DEEZER_LIMIT_INVALID", "Deezer limits must be positive integers.", {
      details: {
        value,
      },
    });
  }

  return parsed;
}

export function normalizeDeezerLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

export function normalizeDeezerUrl(target: string): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(?:www\.)?deezer\.com\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
  }

  if (trimmed.startsWith("/")) {
    return `https://www.deezer.com${trimmed}`;
  }

  return undefined;
}

export function parseDeezerEntityTarget(target: string): { kind: DeezerEntityKind; id: number; url?: string } | undefined {
  const trimmed = target.trim();
  if (!trimmed) {
    return undefined;
  }

  const url = normalizeDeezerUrl(trimmed);
  if (!url) {
    return undefined;
  }

  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/(?:[a-z]{2}\/)?(track|album|artist|playlist)\/(\d+)/i);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return {
    kind: match[1].toLowerCase() as DeezerEntityKind,
    id: Number.parseInt(match[2], 10),
    url: parsed.toString(),
  };
}

export function buildDeezerEntityUrl(kind: DeezerEntityKind, id: number, title?: string): string {
  const slug = title ? `-${slugify(title)}` : "";
  return `https://www.deezer.com/${kind}/${id}${slug}`;
}

export function trimPreview(value: string | null | undefined, max = 240): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
}

export function formatDuration(seconds: number | undefined | null): string | undefined {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) {
    return undefined;
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatCompactNumber(value: number | undefined | null): string | undefined {
  if (!Number.isFinite(value) || value === undefined || value === null) {
    return undefined;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function toTrackSubtitle(track: { artist?: { name?: string }; album?: { title?: string } }): string | undefined {
  const parts = [track.artist?.name, track.album?.title].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.length > 0 ? parts.join(" • ") : undefined;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

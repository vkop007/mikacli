import { MikaCliError } from "../../../errors.js";

export type SoundCloudSearchType = "track" | "playlist" | "user" | "all";

export function parseSoundCloudSearchType(value: string): SoundCloudSearchType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "track" || normalized === "playlist" || normalized === "user" || normalized === "all") {
    return normalized;
  }

  throw new MikaCliError(
    "SOUNDCLOUD_SEARCH_TYPE_INVALID",
    "SoundCloud search type must be one of: track, playlist, user, or all.",
    {
      details: {
        value,
      },
    },
  );
}

export function parseSoundCloudLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MikaCliError("SOUNDCLOUD_LIMIT_INVALID", "SoundCloud limit must be a positive integer.", {
      details: {
        value,
      },
    });
  }

  return parsed;
}

export function normalizeSoundCloudLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

export function normalizeSoundCloudUrl(target: string): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(?:www\.)?(?:soundcloud\.com|on\.soundcloud\.com)\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
  }

  if (trimmed.startsWith("/")) {
    return `https://soundcloud.com${trimmed}`;
  }

  if (trimmed.includes("/") && !trimmed.includes(" ") && !/^\d+$/.test(trimmed)) {
    return `https://soundcloud.com/${trimmed.replace(/^\/+/, "")}`;
  }

  return undefined;
}

export function extractSoundCloudNumericId(target: string): number | undefined {
  const trimmed = target.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatMilliseconds(value: number | undefined | null): string | undefined {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return undefined;
  }

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatCompactNumber(value: number | undefined | null): string | undefined {
  if (!Number.isFinite(value) || value === null || value === undefined) {
    return undefined;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function trimPreview(value: string | null | undefined, max = 320): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
}

export function slugifyFilename(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "soundcloud-track";
}

export function pickAudioExtension(mimeType: string | undefined, protocol: string | undefined): string {
  const mime = mimeType?.toLowerCase() ?? "";
  const normalizedProtocol = protocol?.toLowerCase() ?? "";

  if (mime.includes("mpeg")) {
    return ".mp3";
  }
  if (mime.includes("mp4")) {
    return ".m4a";
  }
  if (mime.includes("ogg") || mime.includes("opus")) {
    return ".ogg";
  }
  if (normalizedProtocol === "progressive") {
    return ".mp3";
  }

  return ".m4a";
}

export function isSoundCloudPlaylistKind(kind: string | undefined): boolean {
  return kind === "playlist" || kind === "system-playlist";
}

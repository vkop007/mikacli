export type SpotifySearchType = "track" | "album" | "artist" | "playlist";
export type SpotifyRepeatState = "off" | "track" | "context";
export type SpotifyTopType = "tracks" | "artists";
export type SpotifyTopRange = "short_term" | "medium_term" | "long_term";
export type SpotifyEngine = "auto" | "web" | "connect";

const SPOTIFY_SEARCH_TYPES = new Set<SpotifySearchType>(["track", "album", "artist", "playlist"]);
const SPOTIFY_REPEAT_STATES = new Set<SpotifyRepeatState>(["off", "track", "context"]);
const SPOTIFY_TOP_TYPES = new Set<SpotifyTopType>(["tracks", "artists"]);
const SPOTIFY_TOP_RANGES = new Set<SpotifyTopRange>(["short_term", "medium_term", "long_term"]);
const SPOTIFY_ENGINES = new Set<SpotifyEngine>(["auto", "web", "connect"]);

export function parseSpotifyLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 50) {
    throw new Error("Expected --limit to be a positive integer between 1 and 50.");
  }

  return parsed;
}

export function parseSpotifySearchTypeOption(value: string): SpotifySearchType {
  const normalized = value.trim().toLowerCase() as SpotifySearchType;
  if (!SPOTIFY_SEARCH_TYPES.has(normalized)) {
    throw new Error("Expected --type to be one of: track, album, artist, playlist.");
  }

  return normalized;
}

export function parseSpotifyPercentValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Expected volume percent to be an integer between 0 and 100.");
  }

  return parsed;
}

export function parseSpotifyBooleanState(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "on", "yes", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "off", "no", "0"].includes(normalized)) {
    return false;
  }

  throw new Error("Expected state to be one of: on, off, true, false, yes, no, 1, 0.");
}

export function parseSpotifyRepeatState(value: string): SpotifyRepeatState {
  const normalized = value.trim().toLowerCase() as SpotifyRepeatState;
  if (!SPOTIFY_REPEAT_STATES.has(normalized)) {
    throw new Error("Expected repeat state to be one of: off, track, context.");
  }

  return normalized;
}

export function parseSpotifyPositionValue(value: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  const parts = trimmed.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
    throw new Error("Expected position to be milliseconds or a mm:ss / hh:mm:ss timestamp.");
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts as [number, number];
    return ((minutes * 60) + seconds) * 1000;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts as [number, number, number];
    return (((hours * 60) + minutes) * 60 + seconds) * 1000;
  }

  throw new Error("Expected position to be milliseconds or a mm:ss / hh:mm:ss timestamp.");
}

export function parseSpotifyTopTypeOption(value: string): SpotifyTopType {
  const normalized = value.trim().toLowerCase() as SpotifyTopType;
  if (!SPOTIFY_TOP_TYPES.has(normalized)) {
    throw new Error("Expected type to be one of: tracks, artists.");
  }

  return normalized;
}

export function parseSpotifyTopRangeOption(value: string): SpotifyTopRange {
  const normalized = value.trim().toLowerCase() as SpotifyTopRange;
  if (!SPOTIFY_TOP_RANGES.has(normalized)) {
    throw new Error("Expected range to be one of: short_term, medium_term, long_term.");
  }

  return normalized;
}

export function parseSpotifyEngineOption(value: string): SpotifyEngine {
  const normalized = value.trim().toLowerCase() as SpotifyEngine;
  if (!SPOTIFY_ENGINES.has(normalized)) {
    throw new Error("Expected --engine to be one of: auto, connect, web.");
  }

  return normalized;
}

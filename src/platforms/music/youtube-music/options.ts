export type YouTubeMusicSearchType = "song" | "video" | "album" | "artist" | "playlist";

const YOUTUBE_MUSIC_SEARCH_TYPES = new Set<YouTubeMusicSearchType>(["song", "video", "album", "artist", "playlist"]);

export function parseYouTubeMusicLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected --limit to be a positive integer.");
  }

  return parsed;
}

export function parseYouTubeMusicSearchTypeOption(value: string): YouTubeMusicSearchType {
  const normalized = value.trim().toLowerCase() as YouTubeMusicSearchType;
  if (!YOUTUBE_MUSIC_SEARCH_TYPES.has(normalized)) {
    throw new Error("Expected --type to be one of: song, video, album, artist, playlist.");
  }

  return normalized;
}

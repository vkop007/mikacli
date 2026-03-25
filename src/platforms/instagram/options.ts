export function parseInstagramLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected --limit to be a positive integer.");
  }

  return parsed;
}

export function parseInstagramPostTypeOption(value: string): "all" | "photo" | "video" | "reel" | "carousel" {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "all":
    case "photo":
    case "video":
    case "reel":
    case "carousel":
      return normalized;
    default:
      throw new Error("Expected --type to be one of: all, photo, video, reel, carousel.");
  }
}

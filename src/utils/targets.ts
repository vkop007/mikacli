import { AutoCliError } from "../errors.js";

const INSTAGRAM_SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function parseInstagramTarget(target: string): {
  mediaId: string;
  shortcode?: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^\d+$/.test(trimmed)) {
    return { mediaId: trimmed };
  }

  const urlMatch = trimmed.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  const shortcode = urlMatch?.[1] ?? (/^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : undefined);

  if (!shortcode) {
    throw new AutoCliError("INVALID_TARGET", "Expected an Instagram URL, shortcode, or numeric media ID.", {
      details: { target },
    });
  }

  return {
    mediaId: instagramShortcodeToMediaId(shortcode),
    shortcode,
    url: urlMatch ? trimmed : undefined,
  };
}

export function parseXTarget(target: string): {
  tweetId: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^\d+$/.test(trimmed)) {
    return { tweetId: trimmed };
  }

  const match = trimmed.match(/status\/(\d+)/i);
  if (!match?.[1]) {
    throw new AutoCliError("INVALID_TARGET", "Expected an X URL or numeric tweet ID.", {
      details: { target },
    });
  }

  return {
    tweetId: match[1],
    url: trimmed,
  };
}

export function instagramShortcodeToMediaId(shortcode: string): string {
  let value = 0n;

  for (const character of shortcode) {
    const index = INSTAGRAM_SHORTCODE_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new AutoCliError("INVALID_TARGET", "Instagram shortcode contains invalid characters.", {
        details: { shortcode },
      });
    }

    value = value * 64n + BigInt(index);
  }

  return value.toString();
}

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

export function parseLinkedInTarget(target: string): {
  entityUrns: string[];
  url?: string;
} {
  const trimmed = target.trim();

  if (trimmed.startsWith("urn:li:activity:") || trimmed.startsWith("urn:li:ugcPost:")) {
    return {
      entityUrns: [trimmed],
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      entityUrns: [`urn:li:activity:${trimmed}`, `urn:li:ugcPost:${trimmed}`],
    };
  }

  const explicitUrnMatch = trimmed.match(/urn%3Ali%3A(activity|ugcPost)%3A(\d+)|urn:li:(activity|ugcPost):(\d+)/i);
  if (explicitUrnMatch) {
    const kind = explicitUrnMatch[1] ?? explicitUrnMatch[3];
    const id = explicitUrnMatch[2] ?? explicitUrnMatch[4];
    if (kind && id) {
      return {
        entityUrns: [`urn:li:${kind}:${id}`],
        url: trimmed,
      };
    }
  }

  const activityMatch = trimmed.match(/activity-(\d+)/i);
  if (activityMatch?.[1]) {
    return {
      entityUrns: [`urn:li:activity:${activityMatch[1]}`, `urn:li:ugcPost:${activityMatch[1]}`],
      url: trimmed,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a LinkedIn URL, urn:li target, or numeric activity ID.", {
    details: { target },
  });
}

export function parseTikTokTarget(target: string): {
  itemId: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^\d+$/.test(trimmed)) {
    return { itemId: trimmed };
  }

  const videoMatch = trimmed.match(/tiktok\.com\/@[^/]+\/(?:video|photo)\/(\d+)/i);
  if (videoMatch?.[1]) {
    return {
      itemId: videoMatch[1],
      url: trimmed,
    };
  }

  throw new AutoCliError(
    "INVALID_TARGET",
    "Expected a TikTok URL in /@user/video/<id> form or a numeric item ID.",
    {
      details: { target },
    },
  );
}

export function parseYouTubeTarget(target: string): {
  videoId: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return { videoId: trimmed };
  }

  const watchMatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch?.[1]) {
    return { videoId: watchMatch[1], url: trimmed };
  }

  const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/i);
  if (shortMatch?.[1]) {
    return { videoId: shortMatch[1], url: trimmed };
  }

  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i);
  if (shortsMatch?.[1]) {
    return { videoId: shortsMatch[1], url: trimmed };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a YouTube URL or 11-character video ID.", {
    details: { target },
  });
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

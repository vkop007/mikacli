import { AutoCliError } from "../errors.js";

const INSTAGRAM_SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function parseFacebookTarget(target: string): {
  objectId: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^\d+(?:_\d+)?$/.test(trimmed)) {
    return { objectId: trimmed };
  }

  const permalinkMatch = trimmed.match(/[?&]story_fbid=(\d+)/i);
  const profileMatch = trimmed.match(/[?&]id=(\d+)/i);
  if (permalinkMatch?.[1]) {
    return {
      objectId: profileMatch?.[1] ? `${profileMatch[1]}_${permalinkMatch[1]}` : permalinkMatch[1],
      url: trimmed,
    };
  }

  const postMatch = trimmed.match(/facebook\.com\/[^/?#]+\/posts\/(\d+)/i);
  if (postMatch?.[1]) {
    return {
      objectId: postMatch[1],
      url: trimmed,
    };
  }

  const videoMatch = trimmed.match(/facebook\.com\/[^/?#]+\/videos\/(\d+)/i);
  if (videoMatch?.[1]) {
    return {
      objectId: videoMatch[1],
      url: trimmed,
    };
  }

  const reelMatch = trimmed.match(/facebook\.com\/reel\/(\d+)/i);
  if (reelMatch?.[1]) {
    return {
      objectId: reelMatch[1],
      url: trimmed,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a Facebook post URL or numeric object ID.", {
    details: { target },
  });
}

export function parseAmazonProductTarget(target: string): {
  asin: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return {
      asin: trimmed.toUpperCase(),
    };
  }

  const match = trimmed.match(/amazon\.[^/]+\/(?:[^?#]+\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (match?.[1]) {
    return {
      asin: match[1].toUpperCase(),
      url: trimmed,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected an Amazon product URL or 10-character ASIN.", {
    details: { target },
  });
}

export function parseFlipkartProductTarget(target: string): {
  pid: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^[A-Z0-9]{12,18}$/i.test(trimmed)) {
    return {
      pid: trimmed.toUpperCase(),
    };
  }

  const match = trimmed.match(/[?&]pid=([A-Z0-9]{12,18})/i);
  if (match?.[1]) {
    return {
      pid: match[1].toUpperCase(),
      url: trimmed,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a Flipkart product URL or raw PID.", {
    details: { target },
  });
}

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

export function parseInstagramProfileTarget(target: string): {
  userId?: string;
  username?: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^\d+$/.test(trimmed)) {
    return {
      userId: trimmed,
    };
  }

  const urlMatch = trimmed.match(/instagram\.com\/(?!p\/|reel\/|tv\/|explore\/|stories\/)([A-Za-z0-9._]+)/i);
  if (urlMatch?.[1]) {
    return {
      username: urlMatch[1],
      url: trimmed,
    };
  }

  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (/^[A-Za-z0-9._]+$/.test(normalized)) {
    return {
      username: normalized,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected an Instagram profile URL, @username, username, or numeric user ID.", {
    details: { target },
  });
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

export function parseXProfileTarget(target: string): {
  userId?: string;
  username?: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (/^\d+$/.test(trimmed)) {
    return {
      userId: trimmed,
    };
  }

  const urlMatch = trimmed.match(/(?:x|twitter)\.com\/(?!i\/|home\/|search\/|explore\/|notifications\/|messages\/|settings\/)([A-Za-z0-9_]+)/i);
  if (urlMatch?.[1]) {
    return {
      username: urlMatch[1],
      url: trimmed,
    };
  }

  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
    return {
      username: normalized,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected an X profile URL, @handle, handle, or numeric user ID.", {
    details: { target },
  });
}

const TWITCH_RESERVED_LOGINS = new Set([
  "",
  "activate",
  "bits",
  "collections",
  "dashboard",
  "directory",
  "downloads",
  "friends",
  "inventory",
  "jobs",
  "login",
  "messages",
  "notifications",
  "payments",
  "prime",
  "products",
  "search",
  "settings",
  "signin",
  "signup",
  "store",
  "subscriptions",
  "turbo",
  "videos",
  "wallet",
]);

export function parseTwitchProfileTarget(target: string): {
  username: string;
  url?: string;
} {
  const trimmed = target.trim();

  if (!trimmed) {
    throw new AutoCliError("INVALID_TARGET", "Expected a Twitch channel URL, @handle, or channel login.", {
      details: { target },
    });
  }

  if (/^https?:\/\//i.test(trimmed)) {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new AutoCliError("INVALID_TARGET", "Expected a valid Twitch channel URL.", {
        details: { target },
      });
    }

    const hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname !== "twitch.tv") {
      throw new AutoCliError("INVALID_TARGET", "Expected a Twitch channel URL.", {
        details: { target },
      });
    }

    const [firstSegment] = parsedUrl.pathname.split("/").filter(Boolean);
    const username = firstSegment?.trim();
    if (username && isValidTwitchLogin(username) && !TWITCH_RESERVED_LOGINS.has(username.toLowerCase())) {
      return {
        username,
        url: trimmed,
      };
    }

    throw new AutoCliError("INVALID_TARGET", "Expected a Twitch channel URL.", {
      details: { target },
    });
  }

  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (isValidTwitchLogin(normalized) && !TWITCH_RESERVED_LOGINS.has(normalized.toLowerCase())) {
    return {
      username: normalized,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a Twitch channel URL, @handle, or channel login.", {
    details: { target },
  });
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

export function parseYouTubeChannelTarget(target: string): {
  channelId?: string;
  url?: string;
  handle?: string;
  path?: string;
} {
  const trimmed = target.trim();

  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) {
    return { channelId: trimmed };
  }

  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i);
  if (channelMatch?.[1]) {
    return {
      channelId: channelMatch[1],
      url: trimmed,
    };
  }

  const handleMatch = trimmed.match(/youtube\.com\/(@[A-Za-z0-9._-]+)/i);
  if (handleMatch?.[1]) {
    return {
      handle: handleMatch[1],
      url: trimmed,
    };
  }

  if (/^@[A-Za-z0-9._-]+$/.test(trimmed)) {
    return {
      handle: trimmed,
    };
  }

  const customPathMatch = trimmed.match(/youtube\.com\/((?:c|user)\/[A-Za-z0-9._-]+)/i);
  if (customPathMatch?.[1]) {
    return {
      path: `/${customPathMatch[1]}`,
      url: trimmed,
    };
  }

  throw new AutoCliError(
    "INVALID_TARGET",
    "Expected a YouTube channel URL, @handle, /channel/<id> URL, or raw UC... channel ID.",
    {
      details: { target },
    },
  );
}

export function parseYouTubePlaylistTarget(target: string): {
  playlistId: string;
  url?: string;
} {
  const trimmed = target.trim();

  const directMatch = trimmed.match(/^(?:PL|UU|LL|FL|RD|OLAK5uy_)[A-Za-z0-9_-]+$/);
  if (directMatch) {
    return {
      playlistId: trimmed,
    };
  }

  const urlMatch = trimmed.match(/[?&]list=([A-Za-z0-9_-]+)/i);
  if (urlMatch?.[1]) {
    return {
      playlistId: urlMatch[1],
      url: trimmed,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a YouTube playlist URL or playlist ID.", {
    details: { target },
  });
}

export function parseBlueskyProfileTarget(target: string): {
  actor: string;
  url?: string;
} {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("INVALID_TARGET", "Expected a Bluesky profile URL, @handle, handle, or DID.", {
      details: { target },
    });
  }

  if (trimmed.startsWith("did:")) {
    return { actor: trimmed };
  }

  const urlMatch = trimmed.match(/bsky\.app\/profile\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return {
      actor: decodeURIComponent(urlMatch[1]),
      url: trimmed,
    };
  }

  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (/^[a-z0-9._:-]+$/i.test(normalized)) {
    return {
      actor: normalized,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a Bluesky profile URL, @handle, handle, or DID.", {
    details: { target },
  });
}

export function parseBlueskyPostTarget(target: string): {
  uri?: string;
  handle?: string;
  rkey?: string;
  url?: string;
} {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("INVALID_TARGET", "Expected a Bluesky post URL or at:// post URI.", {
      details: { target },
    });
  }

  if (/^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/[^/]+$/i.test(trimmed)) {
    return {
      uri: trimmed,
    };
  }

  const urlMatch = trimmed.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/i);
  if (urlMatch?.[1] && urlMatch[2]) {
    return {
      handle: decodeURIComponent(urlMatch[1]),
      rkey: decodeURIComponent(urlMatch[2]),
      url: trimmed,
    };
  }

  const compactMatch = trimmed.match(/^@?([a-z0-9._:-]+)\/([a-z0-9]+)$/i);
  if (compactMatch?.[1] && compactMatch[2]) {
    return {
      handle: compactMatch[1],
      rkey: compactMatch[2],
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a Bluesky post URL or at:// post URI.", {
    details: { target },
  });
}

export function parseThreadsProfileTarget(target: string): {
  username: string;
  url?: string;
} {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("INVALID_TARGET", "Expected a Threads profile URL, @username, or username.", {
      details: { target },
    });
  }

  const urlMatch = trimmed.match(/threads\.net\/@([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return {
      username: decodeURIComponent(urlMatch[1]),
      url: trimmed,
    };
  }

  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (/^[a-z0-9._]+$/i.test(normalized)) {
    return {
      username: normalized,
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a Threads profile URL, @username, or username.", {
    details: { target },
  });
}

export function parseThreadsPostTarget(target: string): {
  username: string;
  postId: string;
  url?: string;
} {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("INVALID_TARGET", "Expected a Threads post URL or @username/postId target.", {
      details: { target },
    });
  }

  const urlMatch = trimmed.match(/threads\.net\/@([^/]+)\/post\/([A-Za-z0-9_-]+)/i);
  if (urlMatch?.[1] && urlMatch[2]) {
    return {
      username: decodeURIComponent(urlMatch[1]),
      postId: urlMatch[2],
      url: trimmed,
    };
  }

  const compactMatch = trimmed.match(/^@?([a-z0-9._]+)\/([A-Za-z0-9_-]+)$/i);
  if (compactMatch?.[1] && compactMatch[2]) {
    return {
      username: compactMatch[1],
      postId: compactMatch[2],
    };
  }

  throw new AutoCliError("INVALID_TARGET", "Expected a Threads post URL or @username/postId target.", {
    details: { target },
  });
}

export type YouTubeMusicBrowseTargetType = "album" | "artist" | "playlist";

export function parseYouTubeMusicBrowseTarget(
  target: string,
  type: YouTubeMusicBrowseTargetType,
): {
  browseId: string;
  url?: string;
  canonicalTarget?: string;
} {
  const trimmed = target.trim();

  const browseUrlMatch = trimmed.match(/music\.youtube\.com\/browse\/([A-Za-z0-9_-]+)/i);
  if (browseUrlMatch?.[1]) {
    return {
      browseId: browseUrlMatch[1],
      url: trimmed,
    };
  }

  if (type === "playlist") {
    const playlistUrlMatch = trimmed.match(/(?:music\.)?youtube\.com\/playlist\?(?:[^#]*&)?list=([A-Za-z0-9_-]+)/i);
    if (playlistUrlMatch?.[1]) {
      return {
        browseId: normalizeYouTubeMusicPlaylistBrowseId(playlistUrlMatch[1]),
        url: trimmed,
        canonicalTarget: playlistUrlMatch[1],
      };
    }

    if (/^(?:VL)?(?:PL|UU|LL|FL|RD|OLAK5uy_)[A-Za-z0-9_-]+$/.test(trimmed)) {
      return {
        browseId: normalizeYouTubeMusicPlaylistBrowseId(trimmed),
        canonicalTarget: trimmed.startsWith("VL") ? trimmed.slice(2) : trimmed,
      };
    }
  }

  if (type === "artist" && /^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) {
    return {
      browseId: trimmed,
    };
  }

  if (type === "album" && /^MPREb[_A-Za-z0-9-]+$/.test(trimmed)) {
    return {
      browseId: trimmed,
    };
  }

  if (type === "playlist" && /^VL[A-Za-z0-9_-]+$/.test(trimmed)) {
    return {
      browseId: trimmed,
      canonicalTarget: trimmed.slice(2),
    };
  }

  throw new AutoCliError("INVALID_TARGET", formatYouTubeMusicBrowseTargetError(type), {
    details: { target, type },
  });
}

export type SpotifyEntityType = "track" | "album" | "artist" | "playlist";

const SPOTIFY_ENTITY_TYPES = ["track", "album", "artist", "playlist"] as const;
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

export function parseSpotifyEntityTarget(
  target: string,
  allowedTypes: readonly SpotifyEntityType[] = SPOTIFY_ENTITY_TYPES,
): {
  type: SpotifyEntityType;
  id: string;
  url?: string;
  uri?: string;
} {
  const trimmed = target.trim();

  const uriMatch = trimmed.match(/^spotify:(track|album|artist|playlist):([A-Za-z0-9]{22})$/i);
  if (uriMatch?.[1] && uriMatch[2]) {
    return buildSpotifyTarget(trimmed, uriMatch[1].toLowerCase() as SpotifyEntityType, uriMatch[2], allowedTypes, {
      uri: trimmed,
    });
  }

  const urlMatch = trimmed.match(/open\.spotify\.com\/(track|album|artist|playlist)\/([A-Za-z0-9]{22})/i);
  if (urlMatch?.[1] && urlMatch[2]) {
    return buildSpotifyTarget(trimmed, urlMatch[1].toLowerCase() as SpotifyEntityType, urlMatch[2], allowedTypes, {
      url: trimmed,
    });
  }

  if (SPOTIFY_ID_PATTERN.test(trimmed)) {
    if (allowedTypes.length === 1 && allowedTypes[0]) {
      return {
        type: allowedTypes[0],
        id: trimmed,
      };
    }

    throw new AutoCliError(
      "INVALID_TARGET",
      "Expected a Spotify URL or spotify: URI so the target type is unambiguous.",
      {
        details: {
          target,
          allowedTypes,
        },
      },
    );
  }

  throw new AutoCliError("INVALID_TARGET", formatSpotifyTargetError(allowedTypes), {
    details: { target, allowedTypes },
  });
}

export function parseSpotifyTrackTarget(target: string): {
  trackId: string;
  url?: string;
  uri?: string;
} {
  const parsed = parseSpotifyEntityTarget(target, ["track"]);
  return {
    trackId: parsed.id,
    url: parsed.url,
    uri: parsed.uri,
  };
}

export function parseSpotifyAlbumTarget(target: string): {
  albumId: string;
  url?: string;
  uri?: string;
} {
  const parsed = parseSpotifyEntityTarget(target, ["album"]);
  return {
    albumId: parsed.id,
    url: parsed.url,
    uri: parsed.uri,
  };
}

export function parseSpotifyArtistTarget(target: string): {
  artistId: string;
  url?: string;
  uri?: string;
} {
  const parsed = parseSpotifyEntityTarget(target, ["artist"]);
  return {
    artistId: parsed.id,
    url: parsed.url,
    uri: parsed.uri,
  };
}

export function parseSpotifyPlaylistTarget(target: string): {
  playlistId: string;
  url?: string;
  uri?: string;
} {
  const parsed = parseSpotifyEntityTarget(target, ["playlist"]);
  return {
    playlistId: parsed.id,
    url: parsed.url,
    uri: parsed.uri,
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

export function instagramMediaIdToShortcode(mediaId: string): string {
  const normalized = mediaId.trim();
  if (!/^\d+$/u.test(normalized)) {
    throw new AutoCliError("INVALID_TARGET", "Expected a numeric Instagram media ID.", {
      details: { mediaId },
    });
  }

  let value = BigInt(normalized);
  if (value === 0n) {
    return INSTAGRAM_SHORTCODE_ALPHABET[0] ?? "A";
  }

  let shortcode = "";
  while (value > 0n) {
    const remainder = Number(value % 64n);
    shortcode = `${INSTAGRAM_SHORTCODE_ALPHABET[remainder]}${shortcode}`;
    value /= 64n;
  }

  return shortcode;
}

function buildSpotifyTarget(
  target: string,
  type: SpotifyEntityType,
  id: string,
  allowedTypes: readonly SpotifyEntityType[],
  extras: {
    url?: string;
    uri?: string;
  },
): {
  type: SpotifyEntityType;
  id: string;
  url?: string;
  uri?: string;
} {
  if (!allowedTypes.includes(type)) {
    throw new AutoCliError("INVALID_TARGET", formatSpotifyTargetError(allowedTypes), {
      details: {
        target,
        allowedTypes,
        detectedType: type,
      },
    });
  }

  return {
    type,
    id,
    ...extras,
  };
}

function formatSpotifyTargetError(allowedTypes: readonly SpotifyEntityType[]): string {
  if (allowedTypes.length === 1 && allowedTypes[0]) {
    return `Expected a Spotify ${allowedTypes[0]} URL, spotify:${allowedTypes[0]} URI, or raw 22-character ${allowedTypes[0]} ID.`;
  }

  return `Expected a Spotify ${allowedTypes.join(", ")} URL or spotify: URI.`;
}

function normalizeYouTubeMusicPlaylistBrowseId(playlistId: string): string {
  return playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;
}

function formatYouTubeMusicBrowseTargetError(type: YouTubeMusicBrowseTargetType): string {
  switch (type) {
    case "album":
      return "Expected a YouTube Music album browse URL or MPRE... browse ID.";
    case "artist":
      return "Expected a YouTube Music artist browse URL or raw UC... artist browse ID.";
    case "playlist":
      return "Expected a YouTube Music playlist URL, playlist ID, or VL... browse ID.";
    default:
      return "Expected a valid YouTube Music browse target.";
  }
}

function isValidTwitchLogin(value: string): boolean {
  return /^[A-Za-z0-9_]{4,25}$/.test(value);
}

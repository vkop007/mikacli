import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import {
  printYouTubeCaptionsResult,
  printYouTubeChannelResult,
  printYouTubeInfoResult,
  printYouTubePlaylistResult,
  printYouTubeSearchResult,
  printYouTubeUploadResult,
} from "../output.js";
import { parseYouTubeLimitOption } from "../options.js";
import { youtubeAdapter } from "../adapter.js";
import { parseBrowserTimeoutSeconds } from "../../../shared/cookie-login.js";

export const youtubeUploadCapability = createAdapterActionCapability({
  id: "upload",
  command: "upload <mediaPath>",
  description: "Upload a YouTube video through YouTube Studio using the saved session",
  spinnerText: "Uploading YouTube video...",
  successMessage: "YouTube upload completed.",
  options: [
    { flags: "--caption <text>", description: "Backward-compatible alias for --title" },
    { flags: "--title <text>", description: "Video title to set in YouTube Studio" },
    { flags: "--description <text>", description: "Video description to set in YouTube Studio" },
    { flags: "--visibility <mode>", description: "Visibility: private, unlisted, or public", parser: parseYouTubeUploadVisibility },
    { flags: "--made-for-kids", description: "Mark the upload as made for kids" },
    { flags: "--not-made-for-kids", description: "Mark the upload as not made for kids (default)" },
    { flags: "--tags <csv>", description: "Comma-separated tags to add in the Studio metadata form", parser: parseYouTubeUploadTags },
    { flags: "--playlist <name>", description: "Playlist name to select in the Studio playlist picker" },
    { flags: "--thumbnail <path>", description: "Optional thumbnail image to upload in Studio" },
    { flags: "--browser-timeout <seconds>", description: "Maximum seconds to allow the browser upload flow to complete", parser: parseYouTubeUploadTimeout },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.postMedia({
      account: options.account as string | undefined,
      mediaPath: String(args[0] ?? ""),
      caption: options.caption as string | undefined,
      title: options.title as string | undefined,
      description: options.description as string | undefined,
      visibility: options.visibility as string | undefined,
      madeForKids: resolveYouTubeMadeForKidsOption(options),
      tags: options.tags as string[] | undefined,
      playlist: options.playlist as string | undefined,
      thumbnailPath: options.thumbnail as string | undefined,
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
  onSuccess: printYouTubeUploadResult,
});

export const youtubePostCapability = createAdapterActionCapability({
  id: "post",
  command: "post <text>",
  description: "Publish a YouTube community post, optionally with one image, through a browser-backed Community tab flow",
  spinnerText: "Publishing YouTube community post...",
  successMessage: "YouTube community post published.",
  options: [
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
    { flags: "--image <path>", description: "Attach one image to the YouTube community post" },
    { flags: "--browser", description: "Force the post through the shared AutoCLI browser profile instead of the invisible browser-backed path" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.postText({
      account: options.account as string | undefined,
      text: String(args[0] ?? ""),
      imagePath: options.image as string | undefined,
      browser: Boolean(options.browser),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});

export const youtubeSearchCapability = createAdapterActionCapability({
  id: "search",
  command: "search <query>",
  description: "Search YouTube videos",
  spinnerText: "Searching YouTube...",
  successMessage: "YouTube search completed.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of results to return (1-25, default: 5)",
      parser: parseYouTubeLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.search({
      account: options.account as string | undefined,
      query: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printYouTubeSearchResult,
});

export const youtubeVideoIdCapability = createAdapterActionCapability({
  id: "videoid",
  command: "videoid <target>",
  aliases: ["info"],
  description: "Load exact YouTube video details by URL or 11-character video ID",
  spinnerText: "Loading YouTube video details...",
  successMessage: "YouTube video details loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.info({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printYouTubeInfoResult,
});

export const youtubeChannelIdCapability = createAdapterActionCapability({
  id: "channelid",
  command: "channelid <target>",
  aliases: ["channel"],
  description: "Load exact YouTube channel details by URL, @handle, or UC... channel ID",
  spinnerText: "Loading YouTube channel details...",
  successMessage: "YouTube channel details loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.channelInfo({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printYouTubeChannelResult,
});

export const youtubePlaylistIdCapability = createAdapterActionCapability({
  id: "playlistid",
  command: "playlistid <target>",
  aliases: ["playlist"],
  description: "Load exact YouTube playlist details by URL or playlist ID",
  spinnerText: "Loading YouTube playlist details...",
  successMessage: "YouTube playlist details loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of playlist items to show (1-25, default: 5)",
      parser: parseYouTubeLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.playlistInfo({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printYouTubePlaylistResult,
});

export const youtubeRelatedCapability = createAdapterActionCapability({
  id: "related",
  command: "related <target>",
  description: "Load related YouTube videos for a given video URL or ID",
  spinnerText: "Loading related YouTube videos...",
  successMessage: "Related YouTube videos loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of related videos to return (1-25, default: 5)",
      parser: parseYouTubeLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.related({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printYouTubeSearchResult,
});

export const youtubeCaptionsCapability = createAdapterActionCapability({
  id: "captions",
  command: "captions <target>",
  description: "List available YouTube caption tracks for a video URL or ID",
  spinnerText: "Loading YouTube caption tracks...",
  successMessage: "YouTube caption tracks loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.captions({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printYouTubeCaptionsResult,
});

function parseYouTubeUploadVisibility(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!["private", "unlisted", "public"].includes(normalized)) {
    throw new Error("Expected --visibility to be one of: private, unlisted, public.");
  }

  return normalized;
}

function parseYouTubeUploadTags(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseYouTubeUploadTimeout(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected --browser-timeout to be a positive integer.");
  }

  return parsed;
}

function resolveYouTubeMadeForKidsOption(options: Record<string, unknown>): boolean | undefined {
  if (options.madeForKids && options.notMadeForKids) {
    throw new Error("Choose either --made-for-kids or --not-made-for-kids, not both.");
  }

  if (options.madeForKids) {
    return true;
  }

  if (options.notMadeForKids) {
    return false;
  }

  return false;
}

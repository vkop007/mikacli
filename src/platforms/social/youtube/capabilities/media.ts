import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import {
  printYouTubeCaptionsResult,
  printYouTubeChannelResult,
  printYouTubeDownloadResult,
  printYouTubeInfoResult,
  printYouTubePlaylistResult,
  printYouTubeSearchResult,
} from "../output.js";
import { parseYouTubeLimitOption } from "../options.js";
import { youtubeAdapter } from "../adapter.js";

export const youtubeDownloadCapability = createAdapterActionCapability({
  id: "download",
  command: "download <target>",
  description: "Download a YouTube video or audio track using yt-dlp and ffmpeg",
  spinnerText: "Downloading YouTube media...",
  successMessage: "YouTube download completed.",
  options: [
    { flags: "--output-dir <path>", description: "Directory to write downloaded files into" },
    { flags: "--filename <template>", description: "yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'" },
    { flags: "--audio-only", description: "Extract audio only instead of video + audio" },
    { flags: "--audio-format <format>", description: "Audio format when using --audio-only (default: mp3)" },
    { flags: "--format <selector>", description: "Custom yt-dlp format selector" },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.download({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      outputDir: options.outputDir as string | undefined,
      filenameTemplate: options.filename as string | undefined,
      audioOnly: Boolean(options.audioOnly),
      audioFormat: options.audioFormat as string | undefined,
      format: options.format as string | undefined,
    }),
  onSuccess: printYouTubeDownloadResult,
});

export const youtubeUploadCapability = createAdapterActionCapability({
  id: "upload",
  command: "upload <mediaPath>",
  description: "Upload a YouTube video with the saved session",
  spinnerText: "Checking YouTube upload support...",
  successMessage: "YouTube upload completed.",
  options: [
    { flags: "--caption <text>", description: "Optional title or description text for a future upload flow" },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.postMedia({
      account: options.account as string | undefined,
      mediaPath: String(args[0] ?? ""),
      caption: options.caption as string | undefined,
    }),
});

export const youtubePostCapability = createAdapterActionCapability({
  id: "post",
  command: "post <text>",
  description: "YouTube text posting is not implemented in this CLI",
  spinnerText: "Checking YouTube posting support...",
  successMessage: "YouTube action completed.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.postText({
      account: options.account as string | undefined,
      text: String(args[0] ?? ""),
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

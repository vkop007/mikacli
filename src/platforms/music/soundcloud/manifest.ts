import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { soundCloudAdapter } from "./adapter.js";
import { parseSoundCloudLimitOption, parseSoundCloudSearchType } from "./helpers.js";
import {
  printSoundCloudDownloadResult,
  printSoundCloudPlaylistResult,
  printSoundCloudSearchResult,
  printSoundCloudTrackResult,
  printSoundCloudUserResult,
} from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const soundCloudPlatformDefinition: PlatformDefinition = {
  id: "soundcloud",
  category: "music",
  displayName: "SoundCloud",
  description: "Search public SoundCloud tracks, playlists, users, and download track audio",
  authStrategies: ["none"],
  adapter: soundCloudAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: "Search public SoundCloud tracks, playlists, users, or all result types",
      spinnerText: "Searching SoundCloud...",
      successMessage: "SoundCloud search completed.",
      options: [
        {
          flags: "--type <kind>",
          description: "Result type: track, playlist, user, or all (default: track)",
          parser: parseSoundCloudSearchType,
        },
        {
          flags: "--limit <number>",
          description: "Maximum number of results to return (default: 5, max: 25)",
          parser: parseSoundCloudLimitOption,
        },
      ],
      action: ({ args, options }) =>
        soundCloudAdapter.search({
          query: String(args[0] ?? ""),
          type: options.type as "track" | "playlist" | "user" | "all" | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printSoundCloudSearchResult,
    }),
    createAdapterActionCapability({
      id: "track",
      command: "track <target>",
      aliases: ["info"],
      description: "Load a SoundCloud track by URL, numeric track ID, or search query",
      spinnerText: "Loading SoundCloud track...",
      successMessage: "SoundCloud track loaded.",
      action: ({ args }) =>
        soundCloudAdapter.trackInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printSoundCloudTrackResult,
    }),
    createAdapterActionCapability({
      id: "playlist",
      command: "playlist <target>",
      description: "Load a SoundCloud playlist by URL, numeric playlist ID, or search query",
      spinnerText: "Loading SoundCloud playlist...",
      successMessage: "SoundCloud playlist loaded.",
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum playlist tracks to print (default: 10, max: 50)",
          parser: parseSoundCloudLimitOption,
        },
      ],
      action: ({ args, options }) =>
        soundCloudAdapter.playlistInfo({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printSoundCloudPlaylistResult,
    }),
    createAdapterActionCapability({
      id: "user",
      command: "user <target>",
      description: "Load a SoundCloud user by URL, numeric user ID, or search query",
      spinnerText: "Loading SoundCloud user...",
      successMessage: "SoundCloud user loaded.",
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum user tracks to print (default: 10, max: 25)",
          parser: parseSoundCloudLimitOption,
        },
      ],
      action: ({ args, options }) =>
        soundCloudAdapter.userInfo({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printSoundCloudUserResult,
    }),
    createAdapterActionCapability({
      id: "related",
      command: "related <target>",
      description: "Load related SoundCloud tracks for a track URL, ID, or search query",
      spinnerText: "Loading related SoundCloud tracks...",
      successMessage: "Related SoundCloud tracks loaded.",
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum related tracks to return (default: 5, max: 25)",
          parser: parseSoundCloudLimitOption,
        },
      ],
      action: ({ args, options }) =>
        soundCloudAdapter.related({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printSoundCloudSearchResult,
    }),
    createAdapterActionCapability({
      id: "download",
      command: "download <target>",
      description: "Download a SoundCloud track by URL, ID, or search query",
      spinnerText: "Downloading SoundCloud track...",
      successMessage: "SoundCloud download completed.",
      options: [
        {
          flags: "--output <path>",
          description: "Optional exact output file path",
        },
        {
          flags: "--output-dir <path>",
          description: "Optional output directory for the saved track",
        },
      ],
      action: ({ args, options }) =>
        soundCloudAdapter.download({
          target: String(args[0] ?? ""),
          output: options.output as string | undefined,
          outputDir: options.outputDir as string | undefined,
        }),
      onSuccess: printSoundCloudDownloadResult,
    }),
  ],
  examples: [
    'mikacli soundcloud search "dandelions"',
    'mikacli soundcloud search "avicii" --type user',
    "mikacli soundcloud track https://soundcloud.com/aditya-tanwar-714460659/ruth-b-dandelions-tiktok",
    "mikacli soundcloud playlist https://soundcloud.com/lofi-hip-hop-music/sets/lofi-lofi",
    "mikacli soundcloud user https://soundcloud.com/aviciiofficial",
    'mikacli soundcloud related "dandelions" --limit 5',
    'mikacli soundcloud download "dandelions" --output-dir ./downloads',
  ],
};

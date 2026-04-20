import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { deezerAdapter } from "./adapter.js";
import { parseDeezerSearchType, parsePositiveInteger } from "./helpers.js";
import {
  printDeezerAlbumResult,
  printDeezerArtistResult,
  printDeezerPlaylistResult,
  printDeezerSearchResult,
  printDeezerTrackResult,
} from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const deezerPlatformDefinition: PlatformDefinition = {
  id: "deezer",
  category: "music",
  displayName: "Deezer",
  description: "Search public Deezer tracks, albums, artists, and playlists through Deezer's public API",
  authStrategies: ["none"],
  adapter: deezerAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: "Search public Deezer tracks, albums, artists, playlists, or all result types",
      spinnerText: "Searching Deezer...",
      successMessage: "Deezer search completed.",
      options: [
        {
          flags: "--type <kind>",
          description: "Result type: track, album, artist, playlist, or all (default: all)",
          parser: parseDeezerSearchType,
        },
        {
          flags: "--limit <number>",
          description: "Maximum number of results to return (default: 5, max: 25)",
          parser: parsePositiveInteger,
        },
      ],
      action: ({ args, options }) =>
        deezerAdapter.search({
          query: String(args[0] ?? ""),
          type: options.type as "track" | "album" | "artist" | "playlist" | "all" | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDeezerSearchResult,
    }),
    createAdapterActionCapability({
      id: "track",
      command: "track <target>",
      aliases: ["info"],
      description: "Load a Deezer track by URL, numeric track ID, or search query",
      spinnerText: "Loading Deezer track...",
      successMessage: "Deezer track loaded.",
      action: ({ args }) =>
        deezerAdapter.trackInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printDeezerTrackResult,
    }),
    createAdapterActionCapability({
      id: "album",
      command: "album <target>",
      description: "Load a Deezer album by URL, numeric album ID, or search query",
      spinnerText: "Loading Deezer album...",
      successMessage: "Deezer album loaded.",
      action: ({ args }) =>
        deezerAdapter.albumInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printDeezerAlbumResult,
    }),
    createAdapterActionCapability({
      id: "artist",
      command: "artist <target>",
      aliases: ["user"],
      description: "Load a Deezer artist by URL, numeric artist ID, or search query",
      spinnerText: "Loading Deezer artist...",
      successMessage: "Deezer artist loaded.",
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum top tracks and releases to print (default: 10, max: 50)",
          parser: parsePositiveInteger,
        },
      ],
      action: ({ args, options }) =>
        deezerAdapter.artistInfo({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDeezerArtistResult,
    }),
    createAdapterActionCapability({
      id: "playlist",
      command: "playlist <target>",
      description: "Load a Deezer playlist by URL, numeric playlist ID, or search query",
      spinnerText: "Loading Deezer playlist...",
      successMessage: "Deezer playlist loaded.",
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum playlist tracks to print (default: 10, max: 50)",
          parser: parsePositiveInteger,
        },
      ],
      action: ({ args, options }) =>
        deezerAdapter.playlistInfo({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDeezerPlaylistResult,
    }),
  ],
  examples: [
    'mikacli deezer search "radiohead"',
    'mikacli deezer search "radiohead" --type album',
    "mikacli deezer track 3135556",
    "mikacli deezer album https://www.deezer.com/album/302127",
    "mikacli deezer artist https://www.deezer.com/artist/382254",
    "mikacli deezer playlist https://www.deezer.com/playlist/908622995",
  ],
};

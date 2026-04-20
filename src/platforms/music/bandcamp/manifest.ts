import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { bandcampAdapter } from "./adapter.js";
import { parseBandcampLimitOption, parseBandcampSearchType } from "./helpers.js";
import { printBandcampAlbumResult, printBandcampArtistResult, printBandcampSearchResult, printBandcampTrackResult } from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const bandcampPlatformDefinition: PlatformDefinition = {
  id: "bandcamp",
  category: "music",
  displayName: "Bandcamp",
  description: "Search public Bandcamp artists, albums, and tracks through Bandcamp's live search and readable pages",
  authStrategies: ["none"],
  adapter: bandcampAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: "Search public Bandcamp artists, albums, tracks, or all result types",
      spinnerText: "Searching Bandcamp...",
      successMessage: "Bandcamp search completed.",
      options: [
        {
          flags: "--type <kind>",
          description: "Result type: artist, album, track, or all (default: all)",
          parser: parseBandcampSearchType,
        },
        {
          flags: "--limit <number>",
          description: "Maximum number of results to return (default: 5, max: 25)",
          parser: parseBandcampLimitOption,
        },
      ],
      action: ({ args, options }) =>
        bandcampAdapter.search({
          query: String(args[0] ?? ""),
          type: options.type as "artist" | "album" | "track" | "all" | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printBandcampSearchResult,
    }),
    createAdapterActionCapability({
      id: "album",
      command: "album <target>",
      description: "Load a Bandcamp album by URL or search query",
      spinnerText: "Loading Bandcamp album...",
      successMessage: "Bandcamp album loaded.",
      action: ({ args }) =>
        bandcampAdapter.albumInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printBandcampAlbumResult,
    }),
    createAdapterActionCapability({
      id: "track",
      command: "track <target>",
      aliases: ["info"],
      description: "Load a Bandcamp track by URL or search query",
      spinnerText: "Loading Bandcamp track...",
      successMessage: "Bandcamp track loaded.",
      action: ({ args }) =>
        bandcampAdapter.trackInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printBandcampTrackResult,
    }),
    createAdapterActionCapability({
      id: "artist",
      command: "artist <target>",
      aliases: ["user"],
      description: "Load a Bandcamp artist by URL or search query",
      spinnerText: "Loading Bandcamp artist...",
      successMessage: "Bandcamp artist loaded.",
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum artist releases to print (default: 10, max: 50)",
          parser: parseBandcampLimitOption,
        },
      ],
      action: ({ args, options }) =>
        bandcampAdapter.artistInfo({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printBandcampArtistResult,
    }),
  ],
  examples: [
    'mikacli bandcamp search "radiohead"',
    'mikacli bandcamp search "radiohead" --type album',
    "mikacli bandcamp album https://radiohead.bandcamp.com/album/in-rainbows",
    "mikacli bandcamp track https://radiohead.bandcamp.com/track/15-step",
    "mikacli bandcamp artist https://radiohead.bandcamp.com/music",
  ],
};

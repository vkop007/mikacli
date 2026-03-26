import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import {
  printSpotifyAlbumResult,
  printSpotifyArtistResult,
  printSpotifyPlaylistResult,
  printSpotifyProfileResult,
  printSpotifySearchResult,
  printSpotifyTrackResult,
} from "../output.js";
import { parseSpotifyLimitOption, parseSpotifySearchTypeOption } from "../options.js";

import type { SpotifyAdapter } from "../service.js";

export function createSpotifyMeCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    description: "Load the authenticated Spotify account profile using the latest saved session by default",
    spinnerText: "Loading Spotify profile...",
    successMessage: "Spotify profile loaded.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ options }) =>
      adapter.me({
        account: options.account as string | undefined,
      }),
    onSuccess: printSpotifyProfileResult,
  });
}

export function createSpotifySearchCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "search",
    command: "search <query>",
    description: "Search Spotify tracks, albums, artists, or playlists using the saved session",
    spinnerText: "Searching Spotify...",
    successMessage: "Spotify search completed.",
    options: [
      {
        flags: "--type <kind>",
        description: "Search result type: track, album, artist, or playlist (default: track)",
        parser: parseSpotifySearchTypeOption,
      },
      {
        flags: "--limit <number>",
        description: "Maximum number of results to return (1-50, default: 5)",
        parser: parseSpotifyLimitOption,
      },
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.search({
        account: options.account as string | undefined,
        query: String(args[0] ?? ""),
        type: options.type as "track" | "album" | "artist" | "playlist" | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printSpotifySearchResult,
  });
}

export function createSpotifyTrackCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "trackid",
    command: "trackid <target>",
    aliases: ["info"],
    description: "Load exact Spotify track details by URL, spotify: URI, or 22-character track ID",
    spinnerText: "Loading Spotify track details...",
    successMessage: "Spotify track details loaded.",
    action: ({ args }) =>
      adapter.trackInfo({
        target: String(args[0] ?? ""),
      }),
    onSuccess: printSpotifyTrackResult,
  });
}

export function createSpotifyAlbumCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "albumid",
    command: "albumid <target>",
    aliases: ["album"],
    description: "Load exact Spotify album details by URL, spotify: URI, or 22-character album ID",
    spinnerText: "Loading Spotify album details...",
    successMessage: "Spotify album details loaded.",
    options: [
      {
        flags: "--limit <number>",
        description: "Maximum number of album tracks to show (1-50, default: 10)",
        parser: parseSpotifyLimitOption,
      },
    ],
    action: ({ args, options }) =>
      adapter.albumInfo({
        target: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printSpotifyAlbumResult,
  });
}

export function createSpotifyArtistCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "artistid",
    command: "artistid <target>",
    aliases: ["artist"],
    description: "Load exact Spotify artist details by URL, spotify: URI, or 22-character artist ID",
    spinnerText: "Loading Spotify artist details...",
    successMessage: "Spotify artist details loaded.",
    options: [
      {
        flags: "--limit <number>",
        description: "Maximum number of top tracks to show (1-50, default: 5)",
        parser: parseSpotifyLimitOption,
      },
    ],
    action: ({ args, options }) =>
      adapter.artistInfo({
        target: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printSpotifyArtistResult,
  });
}

export function createSpotifyPlaylistCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "playlistid",
    command: "playlistid <target>",
    aliases: ["playlist"],
    description: "Load exact Spotify playlist details by URL, spotify: URI, or 22-character playlist ID",
    spinnerText: "Loading Spotify playlist details...",
    successMessage: "Spotify playlist details loaded.",
    options: [
      {
        flags: "--limit <number>",
        description: "Maximum number of playlist tracks to show (1-50, default: 10)",
        parser: parseSpotifyLimitOption,
      },
    ],
    action: ({ args, options }) =>
      adapter.playlistInfo({
        target: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printSpotifyPlaylistResult,
  });
}

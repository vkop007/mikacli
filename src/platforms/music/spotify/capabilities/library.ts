import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { printSpotifyItemsResult, printSpotifyPlaylistsResult } from "../output.js";
import { parseSpotifyLimitOption, parseSpotifyTopRangeOption, parseSpotifyTopTypeOption } from "../options.js";

import type { SpotifyAdapter } from "../service.js";

export function createSpotifyRecentCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "recent",
    command: "recent",
    description: "Show recently played Spotify tracks",
    spinnerText: "Loading recently played Spotify tracks...",
    successMessage: "Spotify recent history loaded.",
    options: [
      {
        flags: "--limit <number>",
        description: "Maximum number of tracks to return (1-50, default: 10)",
        parser: parseSpotifyLimitOption,
      },
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ options }) =>
      adapter.recent({
        account: options.account as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printSpotifyItemsResult,
  });
}

export function createSpotifyTopCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "top",
    command: "top <type>",
    description: "Show top Spotify tracks or artists for the authenticated account",
    spinnerText: "Loading Spotify top items...",
    successMessage: "Spotify top items loaded.",
    options: [
      {
        flags: "--range <range>",
        description: "Time range: short_term, medium_term, or long_term (default: medium_term)",
        parser: parseSpotifyTopRangeOption,
      },
      {
        flags: "--limit <number>",
        description: "Maximum number of items to return (1-50, default: 10)",
        parser: parseSpotifyLimitOption,
      },
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.top({
        account: options.account as string | undefined,
        type: parseSpotifyTopTypeOption(String(args[0] ?? "")),
        range: options.range as "short_term" | "medium_term" | "long_term" | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printSpotifyItemsResult,
  });
}

export function createSpotifySavedTracksCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "savedtracks",
    command: "savedtracks",
    aliases: ["likedtracks", "likes"],
    description: "List saved Spotify tracks from your library",
    spinnerText: "Loading saved Spotify tracks...",
    successMessage: "Saved Spotify tracks loaded.",
    options: [
      {
        flags: "--limit <number>",
        description: "Maximum number of tracks to return (1-50, default: 10)",
        parser: parseSpotifyLimitOption,
      },
      { flags: "--offset <number>", description: "Offset for pagination", parser: Number.parseInt },
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ options }) =>
      adapter.savedTracks({
        account: options.account as string | undefined,
        limit: options.limit as number | undefined,
        offset: options.offset as number | undefined,
      }),
    onSuccess: printSpotifyItemsResult,
  });
}

export function createSpotifyPlaylistsCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "playlists",
    command: "playlists",
    description: "List the authenticated Spotify user's playlists",
    spinnerText: "Loading Spotify playlists...",
    successMessage: "Spotify playlists loaded.",
    options: [
      {
        flags: "--limit <number>",
        description: "Maximum number of playlists to return (1-50, default: 10)",
        parser: parseSpotifyLimitOption,
      },
      { flags: "--offset <number>", description: "Offset for pagination", parser: Number.parseInt },
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ options }) =>
      adapter.playlists({
        account: options.account as string | undefined,
        limit: options.limit as number | undefined,
        offset: options.offset as number | undefined,
      }),
    onSuccess: printSpotifyPlaylistsResult,
  });
}

export function createSpotifyPlaylistCreateCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "playlistcreate",
    command: "playlistcreate <name>",
    aliases: ["playlist-create"],
    description: "Create a Spotify playlist in the authenticated account",
    spinnerText: "Creating Spotify playlist...",
    successMessage: "Spotify playlist created.",
    options: [
      { flags: "--description <text>", description: "Optional playlist description" },
      { flags: "--public", description: "Create the playlist as public" },
      { flags: "--collaborative", description: "Create the playlist as collaborative" },
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.playlistCreate({
        account: options.account as string | undefined,
        name: String(args[0] ?? ""),
        description: options.description as string | undefined,
        public: Boolean(options.public),
        collaborative: Boolean(options.collaborative),
      }),
  });
}

export function createSpotifyPlaylistTracksCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "playlisttracks",
    command: "playlisttracks <target>",
    aliases: ["playlist-tracks"],
    description: "List tracks inside a Spotify playlist",
    spinnerText: "Loading Spotify playlist tracks...",
    successMessage: "Spotify playlist tracks loaded.",
    options: [
      {
        flags: "--limit <number>",
        description: "Maximum number of tracks to return (1-50, default: 10)",
        parser: parseSpotifyLimitOption,
      },
      { flags: "--offset <number>", description: "Offset for pagination", parser: Number.parseInt },
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.playlistTracks({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
        offset: options.offset as number | undefined,
      }),
    onSuccess: printSpotifyItemsResult,
  });
}

export function createSpotifyPlaylistAddCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "playlistadd",
    command: "playlistadd <playlist> <targets...>",
    aliases: ["playlist-add"],
    description: "Add one or more Spotify tracks to a playlist",
    spinnerText: "Adding tracks to Spotify playlist...",
    successMessage: "Spotify playlist updated.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.playlistAdd({
        account: options.account as string | undefined,
        playlist: String(args[0] ?? ""),
        targets: Array.isArray(args[1]) ? args[1].map(String) : [],
      }),
  });
}

export function createSpotifyPlaylistRemoveCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "playlistremove",
    command: "playlistremove <playlist> <targets...>",
    aliases: ["playlist-remove"],
    description: "Remove one or more Spotify tracks from a playlist",
    spinnerText: "Removing tracks from Spotify playlist...",
    successMessage: "Spotify playlist updated.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.playlistRemove({
        account: options.account as string | undefined,
        playlist: String(args[0] ?? ""),
        targets: Array.isArray(args[1]) ? args[1].map(String) : [],
      }),
  });
}

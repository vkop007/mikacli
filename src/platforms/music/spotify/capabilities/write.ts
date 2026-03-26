import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";

import type { SpotifyAdapter } from "../service.js";

export function createSpotifyLikeCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "like",
    command: "like <target>",
    description: "Save a Spotify track to your library by URL, spotify: URI, or 22-character track ID",
    spinnerText: "Saving Spotify track...",
    successMessage: "Spotify track saved.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.like({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
  });
}

export function createSpotifyUnlikeCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "unlike",
    command: "unlike <target>",
    description: "Remove a Spotify track from your library",
    spinnerText: "Removing Spotify track from library...",
    successMessage: "Spotify track removed from library.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.unlike({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
  });
}

export function createSpotifyFollowArtistCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "followartist",
    command: "followartist <target>",
    aliases: ["follow-artist"],
    description: "Follow a Spotify artist by URL, spotify: URI, or 22-character artist ID",
    spinnerText: "Following Spotify artist...",
    successMessage: "Spotify artist followed.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.followArtist({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
  });
}

export function createSpotifyUnfollowArtistCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "unfollowartist",
    command: "unfollowartist <target>",
    aliases: ["unfollow-artist"],
    description: "Unfollow a Spotify artist",
    spinnerText: "Unfollowing Spotify artist...",
    successMessage: "Spotify artist unfollowed.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.unfollowArtist({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
  });
}

export function createSpotifyFollowPlaylistCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "followplaylist",
    command: "followplaylist <target>",
    aliases: ["follow-playlist"],
    description: "Follow a Spotify playlist by URL, spotify: URI, or 22-character playlist ID",
    spinnerText: "Following Spotify playlist...",
    successMessage: "Spotify playlist followed.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.followPlaylist({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
  });
}

export function createSpotifyUnfollowPlaylistCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "unfollowplaylist",
    command: "unfollowplaylist <target>",
    aliases: ["unfollow-playlist"],
    description: "Unfollow a Spotify playlist",
    spinnerText: "Unfollowing Spotify playlist...",
    successMessage: "Spotify playlist unfollowed.",
    options: [{ flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ args, options }) =>
      adapter.unfollowPlaylist({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
  });
}

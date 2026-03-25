import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { printYouTubeMusicBrowseResult, printYouTubeMusicInfoResult, printYouTubeMusicSearchResult } from "../output.js";
import { parseYouTubeMusicLimitOption, parseYouTubeMusicSearchTypeOption } from "../options.js";
import { youtubeMusicAdapter } from "../adapter.js";

export const youtubeMusicSearchCapability = createAdapterActionCapability({
  id: "search",
  command: "search <query>",
  description: "Search YouTube Music songs, videos, albums, artists, or playlists",
  spinnerText: "Searching YouTube Music...",
  successMessage: "YouTube Music search completed.",
  options: [
    {
      flags: "--type <kind>",
      description: "Optional result type filter: song, video, album, artist, or playlist",
      parser: parseYouTubeMusicSearchTypeOption,
    },
    {
      flags: "--limit <number>",
      description: "Maximum number of results to return (1-25, default: 5)",
      parser: parseYouTubeMusicLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" },
  ],
  action: ({ args, options }) =>
    youtubeMusicAdapter.search({
      account: options.account as string | undefined,
      query: String(args[0] ?? ""),
      type: options.type as "song" | "video" | "album" | "artist" | "playlist" | undefined,
      limit: options.limit as number | undefined,
    }),
  onSuccess: printYouTubeMusicSearchResult,
});

export const youtubeMusicSongIdCapability = createAdapterActionCapability({
  id: "songid",
  command: "songid <target>",
  aliases: ["info"],
  description: "Load exact YouTube Music song or music-video details by URL or YouTube video ID",
  spinnerText: "Loading YouTube Music item details...",
  successMessage: "YouTube Music item details loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" }],
  action: ({ args, options }) =>
    youtubeMusicAdapter.info({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printYouTubeMusicInfoResult,
});

export const youtubeMusicRelatedCapability = createAdapterActionCapability({
  id: "related",
  command: "related <target>",
  description: "Load related YouTube Music items for a song or music-video URL or ID",
  spinnerText: "Loading related YouTube Music items...",
  successMessage: "Related YouTube Music items loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of related items to return (1-25, default: 5)",
      parser: parseYouTubeMusicLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" },
  ],
  action: ({ args, options }) =>
    youtubeMusicAdapter.related({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
  }),
  onSuccess: printYouTubeMusicSearchResult,
});

export const youtubeMusicAlbumIdCapability = createAdapterActionCapability({
  id: "albumid",
  command: "albumid <target>",
  description: "Load exact YouTube Music album details by browse URL or MPRE... album ID",
  spinnerText: "Loading YouTube Music album...",
  successMessage: "YouTube Music album loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of album tracks to return (1-25, default: 5)",
      parser: parseYouTubeMusicLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" },
  ],
  action: ({ args, options }) =>
    youtubeMusicAdapter.album({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printYouTubeMusicBrowseResult,
});

export const youtubeMusicArtistIdCapability = createAdapterActionCapability({
  id: "artistid",
  command: "artistid <target>",
  description: "Load exact YouTube Music artist details by browse URL or UC... artist ID",
  spinnerText: "Loading YouTube Music artist...",
  successMessage: "YouTube Music artist loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of results to return per artist section (1-25, default: 5)",
      parser: parseYouTubeMusicLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" },
  ],
  action: ({ args, options }) =>
    youtubeMusicAdapter.artist({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printYouTubeMusicBrowseResult,
});

export const youtubeMusicPlaylistIdCapability = createAdapterActionCapability({
  id: "playlistid",
  command: "playlistid <target>",
  description: "Load exact YouTube Music playlist details by URL, playlist ID, or VL... browse ID",
  spinnerText: "Loading YouTube Music playlist...",
  successMessage: "YouTube Music playlist loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of playlist items to return (1-25, default: 5)",
      parser: parseYouTubeMusicLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" },
  ],
  action: ({ args, options }) =>
    youtubeMusicAdapter.playlist({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printYouTubeMusicBrowseResult,
});

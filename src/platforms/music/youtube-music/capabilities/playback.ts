import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { printYouTubeMusicPlaybackStatusResult, printYouTubeMusicQueueResult } from "../output.js";
import { parseYouTubeMusicLimitOption, parseYouTubeMusicSearchTypeOption } from "../options.js";
import { youtubeMusicAdapter } from "../adapter.js";

export const youtubeMusicPlaybackStatusCapability = createAdapterActionCapability({
  id: "status",
  command: "status",
  description: "Show the local YouTube Music playback controller state",
  spinnerText: "Loading YouTube Music playback status...",
  successMessage: "YouTube Music playback status loaded.",
  action: () => youtubeMusicAdapter.playbackStatus(),
  onSuccess: printYouTubeMusicPlaybackStatusResult,
});

export const youtubeMusicPlayCapability = createAdapterActionCapability({
  id: "play",
  command: "play [target]",
  description: "Start or resume local YouTube Music playback from a track, album, playlist, artist, or search query",
  spinnerText: "Starting YouTube Music playback...",
  successMessage: "YouTube Music playback started.",
  options: [
    {
      flags: "--type <kind>",
      description: "Interpret the target as song, video, album, artist, or playlist",
      parser: parseYouTubeMusicSearchTypeOption,
    },
    {
      flags: "--limit <number>",
      description: "Maximum number of items to queue for collection or search targets (1-25, default: 5)",
      parser: parseYouTubeMusicLimitOption,
    },
    { flags: "--account <name>", description: "Optional session to use while resolving protected YouTube Music targets" },
  ],
  action: ({ args, options }) =>
    youtubeMusicAdapter.play({
      account: options.account as string | undefined,
      target: typeof args[0] === "string" ? args[0] : undefined,
      type: options.type as "song" | "video" | "album" | "artist" | "playlist" | undefined,
      limit: options.limit as number | undefined,
    }),
});

export const youtubeMusicPauseCapability = createAdapterActionCapability({
  id: "pause",
  command: "pause",
  description: "Pause the local YouTube Music playback controller",
  spinnerText: "Pausing YouTube Music playback...",
  successMessage: "YouTube Music playback paused.",
  action: () => youtubeMusicAdapter.pause(),
});

export const youtubeMusicStopCapability = createAdapterActionCapability({
  id: "stop",
  command: "stop",
  description: "Stop the local YouTube Music playback controller",
  spinnerText: "Stopping YouTube Music playback...",
  successMessage: "YouTube Music playback stopped.",
  action: () => youtubeMusicAdapter.stop(),
});

export const youtubeMusicNextCapability = createAdapterActionCapability({
  id: "next",
  command: "next",
  description: "Skip to the next item in the local YouTube Music queue",
  spinnerText: "Skipping to the next YouTube Music item...",
  successMessage: "Skipped to the next YouTube Music item.",
  action: () => youtubeMusicAdapter.next(),
});

export const youtubeMusicPreviousCapability = createAdapterActionCapability({
  id: "previous",
  command: "previous",
  aliases: ["prev"],
  description: "Go to the previous item in the local YouTube Music queue",
  spinnerText: "Going to the previous YouTube Music item...",
  successMessage: "Moved to the previous YouTube Music item.",
  action: () => youtubeMusicAdapter.previous(),
});

export const youtubeMusicQueueCapability = createAdapterActionCapability({
  id: "queue",
  command: "queue",
  description: "Show the local YouTube Music playback queue",
  spinnerText: "Loading the YouTube Music queue...",
  successMessage: "YouTube Music queue loaded.",
  action: () => youtubeMusicAdapter.queue(),
  onSuccess: printYouTubeMusicQueueResult,
});

export const youtubeMusicQueueAddCapability = createAdapterActionCapability({
  id: "queueadd",
  command: "queueadd <target>",
  description: "Add a YouTube Music track, album, playlist, artist, or search query to the local queue",
  spinnerText: "Adding items to the YouTube Music queue...",
  successMessage: "YouTube Music queue updated.",
  options: [
    {
      flags: "--type <kind>",
      description: "Interpret the target as song, video, album, artist, or playlist",
      parser: parseYouTubeMusicSearchTypeOption,
    },
    {
      flags: "--limit <number>",
      description: "Maximum number of items to queue for collection or search targets (1-25, default: 5)",
      parser: parseYouTubeMusicLimitOption,
    },
    { flags: "--account <name>", description: "Optional session to use while resolving protected YouTube Music targets" },
  ],
  action: ({ args, options }) =>
    youtubeMusicAdapter.queueAdd({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      type: options.type as "song" | "video" | "album" | "artist" | "playlist" | undefined,
      limit: options.limit as number | undefined,
    }),
});

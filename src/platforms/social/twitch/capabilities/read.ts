import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parseSocialLimitOption } from "../../shared/options.js";
import { printSocialPostsResult, printSocialSearchResult } from "../../shared/output.js";
import { twitchAdapter } from "../adapter.js";
import { parseTwitchClipPeriodOption } from "../service.js";
import { printTwitchProfileResult, printTwitchStreamResult } from "../output.js";

export const twitchSearchCapability = createAdapterActionCapability({
  id: "search",
  command: "search <query>",
  description: "Search Twitch channels",
  spinnerText: "Searching Twitch...",
  successMessage: "Twitch search completed.",
  options: [
    { flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseSocialLimitOption },
    { flags: "--account <name>", description: "Optional override for a specific saved Twitch session" },
  ],
  action: ({ args, options }) =>
    twitchAdapter.search({
      account: options.account as string | undefined,
      query: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printSocialSearchResult,
});

export const twitchChannelCapability = createAdapterActionCapability({
  id: "channel",
  command: "channel <target>",
  aliases: ["profile", "user"],
  description: "Load a Twitch channel by URL, @handle, or login",
  spinnerText: "Loading Twitch channel...",
  successMessage: "Twitch channel loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Twitch session" }],
  action: ({ args, options }) =>
    twitchAdapter.channelInfo({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printTwitchProfileResult,
});

export const twitchStreamCapability = createAdapterActionCapability({
  id: "stream",
  command: "stream <target>",
  aliases: ["live"],
  description: "Load live stream status for a Twitch channel",
  spinnerText: "Loading Twitch stream status...",
  successMessage: "Twitch stream status loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Twitch session" }],
  action: ({ args, options }) =>
    twitchAdapter.streamInfo({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printTwitchStreamResult,
});

export const twitchVideosCapability = createAdapterActionCapability({
  id: "videos",
  command: "videos <target>",
  aliases: ["vods"],
  description: "List recent Twitch videos for a channel",
  spinnerText: "Loading Twitch videos...",
  successMessage: "Twitch videos loaded.",
  options: [
    { flags: "--limit <number>", description: "Maximum videos to return (default: 5)", parser: parseSocialLimitOption },
    { flags: "--account <name>", description: "Optional override for a specific saved Twitch session" },
  ],
  action: ({ args, options }) =>
    twitchAdapter.videos({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: (result, json) => {
    printSocialPostsResult(result, json, "videos");
  },
});

export const twitchClipsCapability = createAdapterActionCapability({
  id: "clips",
  command: "clips <target>",
  description: "List Twitch clips for a channel",
  spinnerText: "Loading Twitch clips...",
  successMessage: "Twitch clips loaded.",
  options: [
    { flags: "--limit <number>", description: "Maximum clips to return (default: 5)", parser: parseSocialLimitOption },
    {
      flags: "--period <window>",
      description: "Clip window: all-time, last-week, or last-day",
      parser: parseTwitchClipPeriodOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved Twitch session" },
  ],
  action: ({ args, options }) =>
    twitchAdapter.clips({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      period: options.period as "all-time" | "last-week" | "last-day" | undefined,
    }),
  onSuccess: (result, json) => {
    printSocialPostsResult(result, json, "clips");
  },
});

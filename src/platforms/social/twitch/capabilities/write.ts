import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parseBrowserTimeoutSeconds } from "../../../shared/cookie-login.js";
import { twitchAdapter } from "../adapter.js";

export const twitchFollowCapability = createAdapterActionCapability({
  id: "follow",
  command: "follow <target>",
  description: "Follow a Twitch channel by URL, @handle, or login. MikaCLI tries the web mutation first and can switch to the shared browser when needed",
  spinnerText: "Following Twitch channel...",
  successMessage: "Twitch follow completed.",
  options: [
    { flags: "--account <name>", description: "Optional override for a specific saved Twitch session" },
    { flags: "--browser", description: "Force the follow through the shared MikaCLI browser profile instead of trying the direct web mutation first" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ args, options }) =>
    twitchAdapter.follow({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      browser: Boolean(options.browser),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});

export const twitchUnfollowCapability = createAdapterActionCapability({
  id: "unfollow",
  command: "unfollow <target>",
  description: "Unfollow a Twitch channel by URL, @handle, or login",
  spinnerText: "Unfollowing Twitch channel...",
  successMessage: "Twitch unfollow completed.",
  options: [
    { flags: "--account <name>", description: "Optional override for a specific saved Twitch session" },
    { flags: "--browser", description: "Force the unfollow through the shared MikaCLI browser profile instead of trying the direct web mutation first" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ args, options }) =>
    twitchAdapter.unfollow({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      browser: Boolean(options.browser),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});

export const twitchCreateClipCapability = createAdapterActionCapability({
  id: "create-clip",
  command: "create-clip <target>",
  aliases: ["clip"],
  description: "Create a Twitch clip for a live channel through the shared MikaCLI browser profile",
  spinnerText: "Creating Twitch clip...",
  successMessage: "Twitch clip started.",
  options: [
    { flags: "--account <name>", description: "Optional override for a specific saved Twitch session" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the shared browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ args, options }) =>
    twitchAdapter.createClip({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});

export const twitchUpdateStreamCapability = createAdapterActionCapability({
  id: "update-stream",
  command: "update-stream",
  aliases: ["stream-update"],
  description: "Update Twitch stream settings like title, category, tags, or the mature toggle through the shared MikaCLI browser profile",
  spinnerText: "Updating Twitch stream settings...",
  successMessage: "Twitch stream settings updated.",
  options: [
    { flags: "--title <text>", description: "New stream title" },
    { flags: "--category <name>", description: "New category or game name" },
    { flags: "--tags <csv>", description: "Comma-separated stream tags to add", parser: parseTwitchTags },
    { flags: "--clear-tags", description: "Remove existing stream tags before adding new ones" },
    { flags: "--mature", description: "Turn the mature content toggle on" },
    { flags: "--not-mature", description: "Turn the mature content toggle off" },
    { flags: "--account <name>", description: "Optional override for a specific saved Twitch session" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the shared browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ options }) =>
    twitchAdapter.updateStream({
      account: options.account as string | undefined,
      title: options.title as string | undefined,
      category: options.category as string | undefined,
      tags: options.tags as string[] | undefined,
      clearTags: Boolean(options.clearTags),
      mature: resolveTwitchMatureOption(options),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});

function parseTwitchTags(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveTwitchMatureOption(options: Record<string, unknown>): boolean | undefined {
  if (options.mature && options.notMature) {
    throw new Error("Choose either --mature or --not-mature, not both.");
  }

  if (options.mature) {
    return true;
  }

  if (options.notMature) {
    return false;
  }

  return undefined;
}

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parseBrowserTimeoutSeconds } from "../../../shared/cookie-login.js";
import { youtubeAdapter } from "../adapter.js";

export const youtubeLikeCapability = createAdapterActionCapability({
  id: "like",
  command: "like <target>",
  description: "Like a YouTube video by URL or 11-character video ID using the latest saved session by default",
  spinnerText: "Liking YouTube video...",
  successMessage: "YouTube video liked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.like({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const youtubeDislikeCapability = createAdapterActionCapability({
  id: "dislike",
  command: "dislike <target>",
  description: "Dislike a YouTube video by URL or 11-character video ID",
  spinnerText: "Disliking YouTube video...",
  successMessage: "YouTube video disliked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.dislike({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const youtubeUnlikeCapability = createAdapterActionCapability({
  id: "unlike",
  command: "unlike <target>",
  description: "Clear the current like/dislike state for a YouTube video",
  spinnerText: "Clearing YouTube video preference...",
  successMessage: "YouTube video preference cleared.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.unlike({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const youtubeCommentCapability = createAdapterActionCapability({
  id: "comment",
  command: "comment <target> <text>",
  description: "Comment on a YouTube video by URL or 11-character video ID using the latest saved session by default",
  spinnerText: "Sending YouTube comment...",
  successMessage: "YouTube comment sent.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.comment({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      text: String(args[1] ?? ""),
    }),
});

export const youtubeDeleteCapability = createAdapterActionCapability({
  id: "delete",
  command: "delete <target>",
  aliases: ["remove"],
  description: "Delete your own YouTube community post by /post URL, community?lb= URL, or post ID through a browser-backed flow",
  spinnerText: "Deleting YouTube community post...",
  successMessage: "YouTube community post deleted.",
  options: [
    { flags: "--account <name>", description: "Optional override for a specific saved YouTube session" },
    { flags: "--browser", description: "Force the delete through the shared MikaCLI browser profile instead of the invisible browser-backed path" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ args, options }) =>
    youtubeAdapter.deletePost({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      browser: Boolean(options.browser),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});

export const youtubeSubscribeCapability = createAdapterActionCapability({
  id: "subscribe",
  command: "subscribe <target>",
  description: "Subscribe to a YouTube channel by URL, @handle, or UC... channel ID",
  spinnerText: "Subscribing to YouTube channel...",
  successMessage: "YouTube channel subscribed.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.subscribe({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const youtubeUnsubscribeCapability = createAdapterActionCapability({
  id: "unsubscribe",
  command: "unsubscribe <target>",
  description: "Unsubscribe from a YouTube channel by URL, @handle, or UC... channel ID",
  spinnerText: "Unsubscribing from YouTube channel...",
  successMessage: "YouTube channel unsubscribed.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ args, options }) =>
    youtubeAdapter.unsubscribe({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

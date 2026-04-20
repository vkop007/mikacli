import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, parseBrowserTimeoutSeconds, resolveCookieLoginInput } from "../../shared/cookie-login.js";
import { parseSocialLimitOption } from "../shared/options.js";
import { printSocialPostsResult, printSocialProfileResult, printSocialSearchResult, printSocialThreadResult } from "../shared/output.js";
import { redditAdapter } from "./adapter.js";
import { printRedditStatusResult } from "./output.js";

import type { PlatformCapability, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

function createRedditCapabilities(): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save the Reddit session for future CLI use. With no auth flags, MikaCLI opens browser login by default",
      spinnerText: "Saving Reddit session...",
      successMessage: "Reddit session saved.",
      options: createCookieLoginOptions(),
      action: ({ options }) => redditAdapter.login(resolveCookieLoginInput(options)),
      onSuccess: printSocialProfileResult,
    }),
    createAdapterActionCapability({
      id: "status",
      command: "status",
      description: "Show the saved Reddit session status",
      spinnerText: "Checking Reddit session...",
      successMessage: "Reddit session checked.",
      options: [{ flags: "--account <name>", description: "Optional saved Reddit session name to inspect" }],
      action: ({ options }) => redditAdapter.statusAction(options.account as string | undefined),
      onSuccess: printRedditStatusResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Load the current Reddit account profile from the saved session",
      spinnerText: "Loading Reddit profile...",
      successMessage: "Reddit profile loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved Reddit session name to use" }],
      action: ({ options }) => redditAdapter.me(options.account as string | undefined),
      onSuccess: printSocialProfileResult,
    }),
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: "Search public Reddit posts",
      spinnerText: "Searching Reddit...",
      successMessage: "Reddit search completed.",
      options: [
        { flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseSocialLimitOption },
        { flags: "--subreddit <name>", description: "Restrict search to one subreddit" },
      ],
      action: ({ args, options }) =>
        redditAdapter.search({
          query: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
          subreddit: options.subreddit as string | undefined,
        }),
      onSuccess: printSocialSearchResult,
    }),
    createAdapterActionCapability({
      id: "profile",
      command: "profile <target>",
      aliases: ["user"],
      description: "Load a public Reddit profile by username, u/handle, or profile URL",
      spinnerText: "Loading Reddit profile...",
      successMessage: "Reddit profile loaded.",
      action: ({ args }) =>
        redditAdapter.profileInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printSocialProfileResult,
    }),
    createAdapterActionCapability({
      id: "posts",
      command: "posts <target>",
      aliases: ["feed"],
      description: "Load recent public Reddit posts for a user profile",
      spinnerText: "Loading Reddit posts...",
      successMessage: "Reddit posts loaded.",
      options: [{ flags: "--limit <number>", description: "Maximum posts to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options }) =>
        redditAdapter.posts({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: (result, json) => {
        printSocialPostsResult(result, json, "posts");
      },
    }),
    createAdapterActionCapability({
      id: "thread",
      command: "thread <target>",
      aliases: ["info"],
      description: "Load a public Reddit thread by URL, shortlink, or post ID",
      spinnerText: "Loading Reddit thread...",
      successMessage: "Reddit thread loaded.",
      options: [{ flags: "--limit <number>", description: "Maximum replies to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options }) =>
        redditAdapter.threadInfo({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printSocialThreadResult,
    }),
    createAdapterActionCapability({
      id: "post",
      command: "post <subreddit> <title> [text...]",
      description: "Create a Reddit text post, or use --url for a link post",
      spinnerText: "Submitting Reddit post...",
      successMessage: "Reddit post submitted.",
      options: [
        { flags: "--account <name>", description: "Optional saved Reddit session name to use" },
        { flags: "--url <link>", description: "Submit a link post instead of a text post" },
        { flags: "--nsfw", description: "Mark the post as NSFW" },
        { flags: "--spoiler", description: "Mark the post as spoiler" },
        { flags: "--browser", description: "Run the write action in the shared browser profile instead of the saved session" },
        { flags: "--browser-timeout <seconds>", description: "Maximum seconds to allow the browser action to complete", parser: parseBrowserTimeoutSeconds },
      ],
      action: ({ args, options }) =>
        redditAdapter.submitPost({
          account: options.account as string | undefined,
          subreddit: String(args[0] ?? ""),
          title: String(args[1] ?? ""),
          text: Array.isArray(args[2]) ? args[2].join(" ") : (args[2] as string | undefined),
          url: options.url as string | undefined,
          nsfw: Boolean(options.nsfw),
          spoiler: Boolean(options.spoiler),
          browser: Boolean(options.browser),
          browserTimeoutSeconds: options.browserTimeout as number | undefined,
        }),
    }),
    createAdapterActionCapability({
      id: "comment",
      command: "comment <target> <text...>",
      aliases: ["reply"],
      description: "Comment on a Reddit post or comment URL, ID, or fullname",
      spinnerText: "Posting Reddit comment...",
      successMessage: "Reddit comment posted.",
      options: [
        { flags: "--account <name>", description: "Optional saved Reddit session name to use" },
        { flags: "--browser", description: "Run the write action in the shared browser profile instead of the saved session" },
        { flags: "--browser-timeout <seconds>", description: "Maximum seconds to allow the browser action to complete", parser: parseBrowserTimeoutSeconds },
      ],
      action: ({ args, options }) =>
        redditAdapter.commentOnThread({
          account: options.account as string | undefined,
          target: String(args[0] ?? ""),
          text: Array.isArray(args[1]) ? args[1].join(" ") : String(args[1] ?? ""),
          browser: Boolean(options.browser),
          browserTimeoutSeconds: options.browserTimeout as number | undefined,
        }),
    }),
    createAdapterActionCapability({
      id: "upvote",
      command: "upvote <target>",
      aliases: ["like"],
      description: "Upvote a Reddit post or comment URL, ID, or fullname",
      spinnerText: "Upvoting Reddit item...",
      successMessage: "Reddit item upvoted.",
      options: [
        { flags: "--account <name>", description: "Optional saved Reddit session name to use" },
        { flags: "--browser", description: "Run the write action in the shared browser profile instead of the saved session" },
        { flags: "--browser-timeout <seconds>", description: "Maximum seconds to allow the browser action to complete", parser: parseBrowserTimeoutSeconds },
      ],
      action: ({ args, options }) =>
        redditAdapter.upvote({
          account: options.account as string | undefined,
          target: String(args[0] ?? ""),
          browser: Boolean(options.browser),
          browserTimeoutSeconds: options.browserTimeout as number | undefined,
        }),
    }),
    createAdapterActionCapability({
      id: "save",
      command: "save <target>",
      aliases: ["bookmark"],
      description: "Save a Reddit post or comment URL, ID, or fullname",
      spinnerText: "Saving Reddit item...",
      successMessage: "Reddit item saved.",
      options: [
        { flags: "--account <name>", description: "Optional saved Reddit session name to use" },
        { flags: "--browser", description: "Run the write action in the shared browser profile instead of the saved session" },
        { flags: "--browser-timeout <seconds>", description: "Maximum seconds to allow the browser action to complete", parser: parseBrowserTimeoutSeconds },
      ],
      action: ({ args, options }) =>
        redditAdapter.savePost({
          account: options.account as string | undefined,
          target: String(args[0] ?? ""),
          browser: Boolean(options.browser),
          browserTimeoutSeconds: options.browserTimeout as number | undefined,
        }),
    }),
  ];
}

export const redditPlatformDefinition: PlatformDefinition = {
  id: "reddit",
  category: "social",
  displayName: "Reddit",
  description: "Search public Reddit posts and threads, then use a saved session or shared browser profile for writing actions",
  authStrategies: ["none", "cookies"],
  adapter: redditAdapter,
  capabilities: createRedditCapabilities(),
  examples: [
    'mikacli reddit search "bun cli"',
    "mikacli reddit profile spez",
    "mikacli reddit posts u/spez --limit 5",
    "mikacli reddit thread https://www.reddit.com/r/programming/comments/1abc123/example_post/",
    'mikacli reddit post programming "Launching MikaCLI" "It now supports Reddit too."',
    'mikacli reddit comment https://www.reddit.com/r/programming/comments/1abc123/example_post/ "Nice breakdown."',
    "mikacli reddit upvote t3_1abc123",
    "mikacli reddit save https://www.reddit.com/r/programming/comments/1abc123/example_post/",
  ],
};

import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseSocialLimitOption } from "./options.js";
import { printSocialPostsResult, printSocialProfileResult, printSocialSearchResult, printSocialThreadResult } from "./output.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

interface PublicSocialAdapter {
  readonly displayName: string;
  search(input: { query: string; limit?: number }): Promise<AdapterActionResult>;
  profileInfo(input: { target: string }): Promise<AdapterActionResult>;
  posts(input: { target: string; limit?: number }): Promise<AdapterActionResult>;
  threadInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult>;
}

interface PublicSocialCapabilityOptions {
  searchDescription: string;
  profileDescription: string;
  postsDescription: string;
  threadDescription: string;
}

export function createPublicSocialCapabilities(
  adapter: PublicSocialAdapter,
  options: PublicSocialCapabilityOptions,
): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: options.searchDescription,
      spinnerText: `Searching ${adapter.displayName}...`,
      successMessage: `${adapter.displayName} search completed.`,
      options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options: commandOptions }) =>
        adapter.search({
          query: String(args[0] ?? ""),
          limit: commandOptions.limit as number | undefined,
        }),
      onSuccess: printSocialSearchResult,
    }),
    createAdapterActionCapability({
      id: "profile",
      command: "profile <target>",
      aliases: ["user"],
      description: options.profileDescription,
      spinnerText: `Loading ${adapter.displayName} profile...`,
      successMessage: `${adapter.displayName} profile loaded.`,
      action: ({ args }) =>
        adapter.profileInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printSocialProfileResult,
    }),
    createAdapterActionCapability({
      id: "posts",
      command: "posts <target>",
      aliases: ["feed"],
      description: options.postsDescription,
      spinnerText: `Loading ${adapter.displayName} posts...`,
      successMessage: `${adapter.displayName} posts loaded.`,
      options: [{ flags: "--limit <number>", description: "Maximum posts to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options: commandOptions }) =>
        adapter.posts({
          target: String(args[0] ?? ""),
          limit: commandOptions.limit as number | undefined,
        }),
      onSuccess: (result, json) => {
        printSocialPostsResult(result, json, "posts");
      },
    }),
    createAdapterActionCapability({
      id: "thread",
      command: "thread <target>",
      aliases: ["info"],
      description: options.threadDescription,
      spinnerText: `Loading ${adapter.displayName} thread...`,
      successMessage: `${adapter.displayName} thread loaded.`,
      options: [{ flags: "--limit <number>", description: "Maximum replies to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options: commandOptions }) =>
        adapter.threadInfo({
          target: String(args[0] ?? ""),
          limit: commandOptions.limit as number | undefined,
        }),
      onSuccess: printSocialThreadResult,
    }),
  ];
}

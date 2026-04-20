import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseMovieLimitOption } from "../shared/options.js";
import { printMovieProfileResult, printMovieSearchResult, printMovieTitleResult } from "../shared/output.js";
import { letterboxdAdapter } from "./adapter.js";
import { printLetterboxdDiaryResult } from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const letterboxdPlatformDefinition: PlatformDefinition = {
  id: "letterboxd",
  category: "movie",
  displayName: "Letterboxd",
  description: "Search public Letterboxd films and inspect film, profile, and diary data from readable pages and RSS",
  authStrategies: ["none"],
  adapter: letterboxdAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: "Search public Letterboxd film pages by query",
      spinnerText: "Searching Letterboxd...",
      successMessage: "Letterboxd search completed.",
      options: [{ flags: "--limit <number>", description: "Maximum number of results to return (default: 5)", parser: parseMovieLimitOption }],
      action: ({ args, options }) =>
        letterboxdAdapter.search({
          query: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMovieSearchResult,
    }),
    createAdapterActionCapability({
      id: "title",
      command: "title <target>",
      aliases: ["info"],
      description: "Load a Letterboxd film by URL or search query",
      spinnerText: "Loading Letterboxd film...",
      successMessage: "Letterboxd film loaded.",
      action: ({ args }) =>
        letterboxdAdapter.titleInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printMovieTitleResult,
    }),
    createAdapterActionCapability({
      id: "profile",
      command: "profile <target>",
      aliases: ["user"],
      description: "Load a public Letterboxd profile by URL or username",
      spinnerText: "Loading Letterboxd profile...",
      successMessage: "Letterboxd profile loaded.",
      action: ({ args }) =>
        letterboxdAdapter.profileInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printMovieProfileResult,
    }),
    createAdapterActionCapability({
      id: "diary",
      command: "diary <target>",
      aliases: ["feed"],
      description: "Load recent diary entries from a public Letterboxd profile",
      spinnerText: "Loading Letterboxd diary...",
      successMessage: "Letterboxd diary loaded.",
      options: [{ flags: "--limit <number>", description: "Maximum diary entries to return (default: 5)", parser: parseMovieLimitOption }],
      action: ({ args, options }) =>
        letterboxdAdapter.diary({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printLetterboxdDiaryResult,
    }),
  ],
  examples: [
    'mikacli letterboxd search "inception"',
    "mikacli letterboxd title https://letterboxd.com/film/inception/",
    "mikacli letterboxd profile darrencb",
    "mikacli letterboxd diary darrencb --limit 5",
  ],
};

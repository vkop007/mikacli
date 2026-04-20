import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseMovieCountryOption, parseMovieLimitOption } from "../shared/options.js";
import { printMovieAvailabilityResult, printMovieSearchResult, printMovieTitleResult } from "../shared/output.js";
import { justWatchAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const justWatchPlatformDefinition: PlatformDefinition = {
  id: "justwatch",
  category: "movie",
  displayName: "JustWatch",
  description: "Track where movies and shows are streaming with JustWatch's public pages",
  authStrategies: ["none"],
  adapter: justWatchAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "title",
      command: "title <target>",
      aliases: ["info"],
      description: "Load a JustWatch title by URL or slug",
      spinnerText: "Loading JustWatch title details...",
      successMessage: "JustWatch title loaded.",
      options: [
        { flags: "--country <code>", description: "2-letter country code when using a short slug like movie/inception", parser: parseMovieCountryOption },
        { flags: "--type <movie|show>", description: "Optional type hint when using a short slug" },
      ],
      action: ({ args, options }) =>
        justWatchAdapter.titleInfo({
          target: String(args[0] ?? ""),
          country: options.country as string | undefined,
          type: options.type as string | undefined,
        }),
      onSuccess: printMovieTitleResult,
    }),
    createAdapterActionCapability({
      id: "availability",
      command: "availability <target>",
      aliases: ["where-to-watch"],
      description: "Load streaming, rental, and purchase offers for a JustWatch title",
      spinnerText: "Loading JustWatch availability...",
      successMessage: "JustWatch availability loaded.",
      options: [
        { flags: "--country <code>", description: "2-letter country code when using a short slug like movie/inception", parser: parseMovieCountryOption },
        { flags: "--type <movie|show>", description: "Optional type hint when using a short slug" },
        { flags: "--limit <number>", description: "Maximum offers to return (default: 12)", parser: parseMovieLimitOption },
      ],
      action: ({ args, options }) =>
        justWatchAdapter.availability({
          target: String(args[0] ?? ""),
          country: options.country as string | undefined,
          type: options.type as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMovieAvailabilityResult,
    }),
    createAdapterActionCapability({
      id: "trending",
      command: "trending",
      description: "Load trending JustWatch titles for a country and type",
      spinnerText: "Loading JustWatch trending titles...",
      successMessage: "JustWatch trending titles loaded.",
      options: [
        { flags: "--country <code>", description: "2-letter country code (default: US)", parser: parseMovieCountryOption },
        { flags: "--type <movie|show>", description: "Title type to load (default: movie)" },
        { flags: "--limit <number>", description: "Maximum titles to return (default: 10)", parser: parseMovieLimitOption },
      ],
      action: ({ options }) =>
        justWatchAdapter.trending({
          country: options.country as string | undefined,
          type: options.type as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMovieSearchResult,
    }),
    createAdapterActionCapability({
      id: "new",
      command: "new",
      aliases: ["latest", "recent"],
      description: "Load newly added JustWatch titles for a country",
      spinnerText: "Loading JustWatch new titles...",
      successMessage: "JustWatch new titles loaded.",
      options: [
        { flags: "--country <code>", description: "2-letter country code (default: US)", parser: parseMovieCountryOption },
        { flags: "--type <movie|show|all>", description: "Title type to keep (default: all)" },
        { flags: "--limit <number>", description: "Maximum titles to return (default: 10)", parser: parseMovieLimitOption },
      ],
      action: ({ options }) =>
        justWatchAdapter.latest({
          country: options.country as string | undefined,
          type: options.type as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMovieSearchResult,
    }),
  ],
  examples: [
    "mikacli justwatch title https://www.justwatch.com/us/movie/inception",
    "mikacli justwatch availability /us/movie/inception",
    "mikacli justwatch trending --country US --type movie",
    "mikacli justwatch new --country IN --type all --limit 10",
  ],
};

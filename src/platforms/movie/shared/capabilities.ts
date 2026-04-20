import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../shared/cookie-login.js";
import {
  printMovieListResult,
  printMovieProfileResult,
  printMovieRecommendationsResult,
  printMovieSearchResult,
  printMovieStatusResult,
  printMovieTitleResult,
} from "./output.js";
import { parseMovieLimitOption } from "./options.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { BaseMovieAdapter } from "./base-movie-adapter.js";

interface MovieRichAdapter {
  profile(input: { username?: string; account?: string }): Promise<AdapterActionResult>;
  list(input: { username?: string; account?: string; limit?: number; status?: string }): Promise<AdapterActionResult>;
  recommendations(input: { target: string; limit?: number; account?: string }): Promise<AdapterActionResult>;
}

export function createMovieCapabilities(adapter: BaseMovieAdapter): readonly PlatformCapability[] {
  const capabilities: PlatformCapability[] = [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: `Save the ${adapter.displayName} session for future CLI use. With no auth flags, MikaCLI opens browser login by default`,
      spinnerText: `Saving ${adapter.displayName} session...`,
      successMessage: `${adapter.displayName} session saved.`,
      options: createCookieLoginOptions(),
      action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
    }),
    createAdapterActionCapability({
      id: "status",
      command: "status",
      description: `Show the saved ${adapter.displayName} session status`,
      spinnerText: `Checking ${adapter.displayName} session status...`,
      successMessage: `${adapter.displayName} status loaded.`,
      options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printMovieStatusResult,
    }),
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: `Search ${adapter.displayName} titles`,
      spinnerText: `Searching ${adapter.displayName}...`,
      successMessage: `${adapter.displayName} search completed.`,
      options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseMovieLimitOption }],
      action: ({ args, options }) =>
        adapter.search({
          query: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMovieSearchResult,
    }),
    createAdapterActionCapability({
      id: "title",
      command: "title <target>",
      aliases: ["info"],
      description: `Load ${adapter.displayName} details by URL, ID, or query`,
      spinnerText: `Loading ${adapter.displayName} title details...`,
      successMessage: `${adapter.displayName} title loaded.`,
      options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
      action: ({ args, options }) =>
        adapter.titleInfo({
          target: String(args[0] ?? ""),
          account: options.account as string | undefined,
        }),
      onSuccess: printMovieTitleResult,
    }),
  ];

  const richAdapter = adapter as BaseMovieAdapter & Partial<MovieRichAdapter>;
  if (typeof richAdapter.profile === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "profile",
        command: "profile [username]",
        aliases: ["account", "me"],
        description: `Load a ${adapter.displayName} profile`,
        spinnerText: `Loading ${adapter.displayName} profile...`,
        successMessage: `${adapter.displayName} profile loaded.`,
        options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
        action: ({ args, options }) =>
          richAdapter.profile!({
            username: args[0] ? String(args[0]) : undefined,
            account: options.account as string | undefined,
          }),
        onSuccess: printMovieProfileResult,
      }),
    );
  }

  if (typeof richAdapter.list === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "list",
        command: "list [username]",
        aliases: ["watchlist", "animelist"],
        description: `Load a ${adapter.displayName} list`,
        spinnerText: `Loading ${adapter.displayName} list...`,
        successMessage: `${adapter.displayName} list loaded.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          { flags: "--status <value>", description: "Optional list status filter" },
          { flags: "--limit <number>", description: "Maximum items to return (default: 25)", parser: parseMovieLimitOption },
        ],
        action: ({ args, options }) =>
          richAdapter.list!({
            username: args[0] ? String(args[0]) : undefined,
            account: options.account as string | undefined,
            status: options.status as string | undefined,
            limit: options.limit as number | undefined,
          }),
        onSuccess: printMovieListResult,
      }),
    );
  }

  if (typeof richAdapter.recommendations === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "recommendations",
        command: "recommendations <target>",
        aliases: ["recs"],
        description: `Load ${adapter.displayName} recommendations for a title`,
        spinnerText: `Loading ${adapter.displayName} recommendations...`,
        successMessage: `${adapter.displayName} recommendations loaded.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          { flags: "--limit <number>", description: "Maximum recommendations to return (default: 5)", parser: parseMovieLimitOption },
        ],
        action: ({ args, options }) =>
          richAdapter.recommendations!({
            target: String(args[0] ?? ""),
            limit: options.limit as number | undefined,
            account: options.account as string | undefined,
          }),
        onSuccess: printMovieRecommendationsResult,
      }),
    );
  }

  return capabilities;
}

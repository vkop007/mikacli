import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseMovieLimitOption } from "../shared/options.js";
import { printMovieSearchResult, printMovieTitleResult } from "../shared/output.js";
import { imdbAdapter } from "./adapter.js";

import type { PlatformCapability, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const imdbCapabilities: readonly PlatformCapability[] = [
  createAdapterActionCapability({
    id: "search",
    command: "search <query>",
    description: "Search IMDb titles through the public suggestion feed",
    spinnerText: "Searching IMDb...",
    successMessage: "IMDb search completed.",
    options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseMovieLimitOption }],
    action: ({ args, options }) =>
      imdbAdapter.search({
        query: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printMovieSearchResult,
  }),
  createAdapterActionCapability({
    id: "title",
    command: "title <target>",
    aliases: ["info"],
    description: "Load an IMDb title by URL, title ID, or query",
    spinnerText: "Loading IMDb title details...",
    successMessage: "IMDb title loaded.",
    action: ({ args }) =>
      imdbAdapter.titleInfo({
        target: String(args[0] ?? ""),
      }),
    onSuccess: printMovieTitleResult,
  }),
];

export const imdbPlatformDefinition: PlatformDefinition = {
  id: "imdb",
  category: "movie",
  displayName: "IMDb",
  description: "Search IMDb titles from the terminal using the public suggestion feed",
  authStrategies: ["none"],
  adapter: imdbAdapter,
  capabilities: imdbCapabilities,
  examples: [
    'autocli imdb search "inception"',
    "autocli imdb title tt1375666",
    "autocli imdb info https://www.imdb.com/title/tt1375666/",
  ],
};

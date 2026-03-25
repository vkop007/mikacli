import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { webSearchAdapter, type WebSearchAdapter } from "../adapter.js";
import { printWebSearchResults } from "../output.js";

export function createWebSearchSearchCapability(adapter: WebSearchAdapter) {
  return createAdapterActionCapability({
    id: "search",
    command: "search <query>",
    description: "Search the web using one engine or query all supported engines at once",
    spinnerText: "Searching the web...",
    successMessage: "Web search completed.",
    options: [
      { flags: "--engine <engine>", description: "Search engine: duckduckgo, bing, brave, google, yahoo, yandex, baidu" },
      { flags: "--all", description: "Search all supported engines and group the results" },
      { flags: "--limit <number>", description: "Maximum results per engine (default: 10)", parser: parsePositiveInteger },
      { flags: "--summary", description: "Fetch and extract page summaries for the first few results" },
      { flags: "--summary-limit <number>", description: "Maximum fetched summaries per engine (default: 3)", parser: parsePositiveInteger },
    ],
    action: ({ args, options }) =>
      adapter.search({
        query: String(args[0] ?? ""),
        engine: options.engine as string | undefined,
        all: Boolean(options.all),
        limit: options.limit as number | undefined,
        summary: Boolean(options.summary),
        summaryLimit: options.summaryLimit as number | undefined,
      }),
    onSuccess: printWebSearchResults,
  });
}

export const webSearchSearchCapability = createWebSearchSearchCapability(webSearchAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}

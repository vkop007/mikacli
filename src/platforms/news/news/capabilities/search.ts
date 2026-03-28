import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { newsAdapter } from "../adapter.js";
import { printNewsItemsResult } from "../output.js";
import { normalizePositiveInteger } from "../helpers.js";

function joinText(args: unknown[]): string {
  const first = args[0];
  if (Array.isArray(first)) {
    return first.map((part) => String(part)).join(" ").trim();
  }

  return String(first ?? "").trim();
}

export const newsSearchCapability = createAdapterActionCapability({
  id: "search",
  command: "search <query...>",
  description: "Search no-auth news sources by query",
  spinnerText: "Searching news...",
  successMessage: "News search completed.",
  options: [
    { flags: "--source <source>", description: "Limit to one source: all, google, gdelt, reddit" },
    { flags: "--language <code>", description: "Language hint used by Google News and GDELT" },
    { flags: "--region <code>", description: "Region hint used by Google News (for example US, IN, GB)" },
    { flags: "--subreddit <name>", description: "Search within a Reddit subreddit" },
    { flags: "--limit <number>", description: "Maximum results to return (default: 10)", parser: (value) => normalizePositiveInteger(value, "limit") },
    { flags: "--summary", description: "Fetch page summaries for the first few results" },
    { flags: "--summary-limit <number>", description: "Maximum fetched summaries (default: 3)", parser: (value) => normalizePositiveInteger(value, "summary-limit") },
  ],
  action: ({ args, options }) =>
    newsAdapter.search({
      query: joinText(args),
      source: options.source as string | undefined,
      language: options.language as string | undefined,
      region: options.region as string | undefined,
      subreddit: options.subreddit as string | undefined,
      limit: options.limit as number | undefined,
      summary: Boolean(options.summary),
      summaryLimit: options.summaryLimit as number | undefined,
    }),
  onSuccess: printNewsItemsResult,
});

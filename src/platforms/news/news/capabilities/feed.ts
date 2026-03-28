import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { newsAdapter } from "../adapter.js";
import { printNewsItemsResult } from "../output.js";
import { normalizePositiveInteger } from "../helpers.js";

export const newsFeedCapability = createAdapterActionCapability({
  id: "feed",
  command: "feed <url>",
  description: "Read any RSS or Atom feed URL",
  spinnerText: "Loading feed...",
  successMessage: "Feed loaded.",
  options: [
    { flags: "--limit <number>", description: "Maximum results to return (default: 10)", parser: (value) => normalizePositiveInteger(value, "limit") },
    { flags: "--summary", description: "Fetch page summaries for the first few results" },
    { flags: "--summary-limit <number>", description: "Maximum fetched summaries (default: 3)", parser: (value) => normalizePositiveInteger(value, "summary-limit") },
  ],
  action: ({ args, options }) =>
    newsAdapter.feed({
      feedUrl: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      summary: Boolean(options.summary),
      summaryLimit: options.summaryLimit as number | undefined,
    }),
  onSuccess: printNewsItemsResult,
});

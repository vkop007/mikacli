import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { rssAdapter, type RssAdapter } from "../adapter.js";
import { printRssResult } from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createRssCapabilities(adapter: RssAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "fetch",
      command: "rss <feedUrl>",
      description: "Fetch and parse an RSS or Atom feed URL",
      spinnerText: "Loading RSS feed...",
      successMessage: "RSS feed loaded.",
      options: [
        { flags: "--limit <number>", description: "Maximum number of feed items to load (default: 10)" },
        { flags: "--summary", description: "Fetch article summaries for the first items when available" },
        { flags: "--summary-limit <number>", description: "Maximum items to summarize (default: 3)" },
      ],
      action: ({ args, options }) =>
        adapter.fetch({
          feedUrl: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
          summary: Boolean(options.summary),
          summaryLimit: options.summaryLimit as number | undefined,
        }),
      onSuccess: printRssResult,
    }),
  ];
}

export const rssCapabilities: readonly PlatformCapability[] = createRssCapabilities(rssAdapter);

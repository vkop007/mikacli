import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { sitemapAdapter, type SitemapAdapter } from "../adapter.js";
import { printSitemapResult } from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createSitemapCapabilities(adapter: SitemapAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "fetch",
      command: "sitemap <url>",
      description: "Fetch and parse a sitemap.xml or sitemap index",
      spinnerText: "Loading sitemap...",
      successMessage: "Sitemap loaded.",
      options: [
        { flags: "--limit <number>", description: "Maximum number of URLs to return (default: 100)" },
        { flags: "--depth <number>", description: "How many sitemap index levels to follow (default: 1)" },
      ],
      action: ({ args, options }) =>
        adapter.fetch({
          url: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
          depth: options.depth as number | undefined,
        }),
      onSuccess: printSitemapResult,
    }),
  ];
}

export const sitemapCapabilities: readonly PlatformCapability[] = createSitemapCapabilities(sitemapAdapter);

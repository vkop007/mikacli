import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { markdownFetchAdapter, type MarkdownFetchAdapter } from "../adapter.js";
import { printMarkdownFetchResult } from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createMarkdownFetchCapabilities(adapter: MarkdownFetchAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "fetch",
      command: "markdown-fetch <url>",
      description: "Fetch a web page and convert it into readable markdown",
      spinnerText: "Loading page...",
      successMessage: "Page loaded.",
      options: [
        { flags: "--max-chars <number>", description: "Maximum markdown characters to keep (default: 6000)" },
        { flags: "--include-links", description: "Preserve inline links in markdown output" },
      ],
      action: ({ args, options }) =>
        adapter.fetch({
          url: String(args[0] ?? ""),
          maxChars: options.maxChars as number | undefined,
          includeLinks: Boolean(options.includeLinks),
        }),
      onSuccess: printMarkdownFetchResult,
    }),
  ];
}

export const markdownFetchCapabilities: readonly PlatformCapability[] = createMarkdownFetchCapabilities(markdownFetchAdapter);

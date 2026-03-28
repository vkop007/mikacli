import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { robotsAdapter, type RobotsAdapter } from "../adapter.js";
import { printRobotsResult } from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createRobotsCapabilities(adapter: RobotsAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "inspect",
      command: "robots <url>",
      description: "Fetch and parse a robots.txt file",
      spinnerText: "Loading robots.txt...",
      successMessage: "robots.txt loaded.",
      options: [{ flags: "--follow-sitemaps", description: "Return sitemap directives in the parsed data" }],
      action: ({ args, options }) =>
        adapter.inspect({
          url: String(args[0] ?? ""),
          followSitemaps: Boolean(options.followSitemaps),
        }),
      onSuccess: printRobotsResult,
    }),
  ];
}

export const robotsCapabilities: readonly PlatformCapability[] = createRobotsCapabilities(robotsAdapter);

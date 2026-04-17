import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseCareersLimitOption } from "./options.js";
import { printCareersSearchResult } from "./output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { IndeedAdapter } from "../indeed/service.js";

export function createCareersCapabilities(adapter: IndeedAdapter | any): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: `Search for jobs on ${adapter.displayName}`,
      spinnerText: `Searching ${adapter.displayName}...`,
      successMessage: `${adapter.displayName} job search completed.`,
      options: [
        {
          flags: "--location <location>",
          description: "Filter jobs by location (e.g., 'San Francisco', 'New York')",
        },
        {
          flags: "--limit <number>",
          description: "Maximum number of results to return (1-50, default: 10)",
          parser: parseCareersLimitOption,
        },
        {
          flags: "--job-type <type>",
          description: "Filter by job type (full-time, part-time, contract, temporary)",
        },
      ],
      action: ({ args, options }) =>
        adapter.search({
          query: String(args[0] ?? ""),
          location: options.location as string | undefined,
          limit: options.limit as number | undefined,
          jobType: options["job-type"] as string | undefined,
        }),
      onSuccess: printCareersSearchResult,
    }),
  ];
}

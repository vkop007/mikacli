import { ziprecruiterAdapter } from "./adapter.js";
import { createCareersCapabilities } from "../shared/capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const ziprecruiterPlatformDefinition: PlatformDefinition = {
  id: "ziprecruiter",
  category: "careers",
  displayName: "ZipRecruiter",
  description: "Search and browse job listings from ZipRecruiter, America's largest job marketplace",
  authStrategies: ["none"],
  adapter: ziprecruiterAdapter,
  capabilities: createCareersCapabilities(ziprecruiterAdapter),
  examples: [
    'mikacli careers ziprecruiter search "software engineer"',
    'mikacli careers ziprecruiter search "product manager" --location "Austin"',
    'mikacli careers ziprecruiter search "marketing manager" --limit 15',
    'mikacli careers ziprecruiter search "data analyst" --job-type "contract"',
    'mikacli careers ziprecruiter search "devops engineer" --location "Seattle" --limit 10 --json',
  ],
};

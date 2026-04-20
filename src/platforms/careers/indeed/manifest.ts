import { indeedAdapter } from "./adapter.js";
import { createCareersCapabilities } from "../shared/capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const indeedPlatformDefinition: PlatformDefinition = {
  id: "indeed",
  category: "careers",
  displayName: "Indeed",
  description: "Search job listings on Indeed, the world's largest job board",
  authStrategies: ["none"],
  adapter: indeedAdapter,
  capabilities: createCareersCapabilities(indeedAdapter),
  examples: [
    'mikacli careers indeed search "software engineer"',
    'mikacli careers indeed search "data scientist" --location "New York"',
    'mikacli careers indeed search "frontend developer" --limit 10',
    'mikacli careers indeed search "python developer" --job-type "full-time"',
    'mikacli careers indeed search "ui designer" --location "San Francisco" --limit 20 --json',
  ],
};

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
    'autocli careers indeed search "software engineer"',
    'autocli careers indeed search "data scientist" --location "New York"',
    'autocli careers indeed search "frontend developer" --limit 10',
    'autocli careers indeed search "python developer" --job-type "full-time"',
    'autocli careers indeed search "ui designer" --location "San Francisco" --limit 20 --json',
  ],
};

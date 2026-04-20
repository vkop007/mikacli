import { amazonAdapter } from "./adapter.js";
import { createShoppingCapabilities } from "../shared/capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const amazonPlatformDefinition: PlatformDefinition = {
  id: "amazon",
  category: "shopping",
  displayName: "Amazon",
  description: "Search Amazon, inspect product details, and validate imported shopping sessions across the correct marketplace domain",
  authStrategies: ["cookies"],
  adapter: amazonAdapter,
  capabilities: createShoppingCapabilities(amazonAdapter),
  examples: [
    "mikacli shopping amazon login",
    "mikacli shopping amazon login --cookies ./amazon.cookies.json",
    'mikacli shopping amazon search "wireless mouse" --limit 5',
    "mikacli shopping amazon product B0B296NTFV",
    "mikacli shopping amazon add-to-cart B0B296NTFV --qty 1",
    "mikacli shopping amazon update-cart B0B296NTFV --qty 2",
    "mikacli shopping amazon remove-from-cart B0B296NTFV",
    "mikacli shopping amazon cart --browser",
    "mikacli shopping amazon orders --browser --limit 5",
  ],
};

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
    "autocli shopping amazon login --cookies ./amazon.cookies.json",
    'autocli shopping amazon search "wireless mouse" --limit 5',
    "autocli shopping amazon product B0B296NTFV",
    "autocli shopping amazon add-to-cart B0B296NTFV --qty 1",
    "autocli shopping amazon update-cart B0B296NTFV --qty 2",
    "autocli shopping amazon remove-from-cart B0B296NTFV",
    "autocli shopping amazon cart --browser",
    "autocli shopping amazon orders --browser --limit 5",
  ],
};

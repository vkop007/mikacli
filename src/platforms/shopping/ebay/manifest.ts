import { createPublicShoppingCapabilities } from "../shared/public-capabilities.js";
import { ebayAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const ebayPlatformDefinition: PlatformDefinition = {
  id: "ebay",
  category: "shopping",
  displayName: "eBay",
  description: "Search public eBay listings, inspect item details, browse seller profiles, and get eBay autocomplete suggestions",
  authStrategies: ["none"],
  adapter: ebayAdapter,
  capabilities: createPublicShoppingCapabilities(ebayAdapter, {
    searchDescription: "Search public eBay listings without cookies or an API key",
    productDescription: "Load an eBay item by URL, numeric item ID, or search query",
    productAliases: ["item", "info"],
    storeCommand: "seller <target>",
    storeAliases: ["store", "user"],
    storeDescription: "Load a public eBay seller by profile URL or seller username",
    suggestionsCommand: "suggest <query>",
    suggestionsAliases: ["autocomplete"],
    suggestionsDescription: "Load eBay query suggestions from the public autosuggest endpoint",
  }),
  examples: [
    'mikacli ebay search "wireless mouse" --limit 5',
    "mikacli ebay product 147218374447",
    "mikacli ebay seller avicii",
    'mikacli ebay suggest "wireless mouse"',
  ],
};

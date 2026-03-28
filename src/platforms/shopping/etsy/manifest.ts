import { createPublicShoppingCapabilities } from "../shared/public-capabilities.js";
import { etsyAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const etsyPlatformDefinition: PlatformDefinition = {
  id: "etsy",
  category: "shopping",
  displayName: "Etsy",
  description: "Discover public Etsy listings and shops without cookies, using public search discovery when direct Etsy pages are protected",
  authStrategies: ["none"],
  adapter: etsyAdapter,
  capabilities: createPublicShoppingCapabilities(etsyAdapter, {
    searchDescription: "Search public Etsy listings via public site-search discovery",
    productDescription: "Load an Etsy listing by URL, numeric listing ID, or search query",
    productAliases: ["listing", "info"],
    storeCommand: "shop <target>",
    storeAliases: ["seller", "store"],
    storeDescription: "Load an Etsy shop by shop URL or shop name via public discovery",
  }),
  examples: [
    'autocli etsy search "wireless mouse" --limit 5',
    "autocli etsy product https://www.etsy.com/listing/4383876994/wisp-16g-ultralight-wireless-gaming",
    "autocli etsy shop plannerkate1",
  ],
};

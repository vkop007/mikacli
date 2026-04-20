import { flipkartAdapter } from "./adapter.js";
import { createShoppingCapabilities } from "../shared/capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const flipkartPlatformDefinition: PlatformDefinition = {
  id: "flipkart",
  category: "shopping",
  displayName: "Flipkart",
  description: "Search Flipkart, inspect products, and control account data like orders, wishlist, and cart using cookies",
  authStrategies: ["cookies"],
  adapter: flipkartAdapter,
  capabilities: createShoppingCapabilities(flipkartAdapter),
  examples: [
    "mikacli shopping flipkart login",
    "mikacli shopping flipkart login --cookies ./flipkart.cookies.json",
    'mikacli shopping flipkart search "wireless mouse" --limit 5',
    "mikacli shopping flipkart product ACCH9SPTRHTWG8QH",
    "mikacli shopping flipkart account",
    "mikacli shopping flipkart wishlist --limit 5",
    "mikacli shopping flipkart cart",
    "mikacli shopping flipkart add-to-cart ACCHJKYDZVJAR6ZY --qty 1",
    "mikacli shopping flipkart update-cart ACCHJKYDZVJAR6ZY --qty 2",
    "mikacli shopping flipkart remove-from-cart ACCHJKYDZVJAR6ZY",
    "mikacli shopping flipkart orders --limit 5",
    "mikacli shopping flipkart order OD437053000184271100",
  ],
};

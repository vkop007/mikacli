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
    "autocli shopping flipkart login",
    "autocli shopping flipkart login --cookies ./flipkart.cookies.json",
    'autocli shopping flipkart search "wireless mouse" --limit 5',
    "autocli shopping flipkart product ACCH9SPTRHTWG8QH",
    "autocli shopping flipkart account",
    "autocli shopping flipkart wishlist --limit 5",
    "autocli shopping flipkart cart",
    "autocli shopping flipkart add-to-cart ACCHJKYDZVJAR6ZY --qty 1",
    "autocli shopping flipkart update-cart ACCHJKYDZVJAR6ZY --qty 2",
    "autocli shopping flipkart remove-from-cart ACCHJKYDZVJAR6ZY",
    "autocli shopping flipkart orders --limit 5",
    "autocli shopping flipkart order OD437053000184271100",
  ],
};

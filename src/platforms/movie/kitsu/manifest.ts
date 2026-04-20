import { createPublicMovieCapabilities } from "../shared/public-capabilities.js";
import { kitsuAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const kitsuPlatformDefinition: PlatformDefinition = {
  id: "kitsu",
  category: "movie",
  displayName: "Kitsu",
  description: "Search anime and inspect titles through Kitsu's public API",
  authStrategies: ["none"],
  adapter: kitsuAdapter,
  capabilities: createPublicMovieCapabilities(kitsuAdapter, {
    searchDescription: "Search Kitsu anime titles through the public JSON:API endpoint",
    titleDescription: "Load a Kitsu anime by URL, anime ID, or query",
  }),
  examples: [
    'mikacli kitsu search "naruto"',
    "mikacli kitsu title 1555",
    "mikacli kitsu info https://kitsu.io/anime/naruto-shippuden",
  ],
};

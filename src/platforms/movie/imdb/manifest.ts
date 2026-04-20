import { createPublicMovieCapabilities } from "../shared/public-capabilities.js";
import { imdbAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const imdbPlatformDefinition: PlatformDefinition = {
  id: "imdb",
  category: "movie",
  displayName: "IMDb",
  description: "Search IMDb titles from the terminal using the public suggestion feed",
  authStrategies: ["none"],
  adapter: imdbAdapter,
  capabilities: createPublicMovieCapabilities(imdbAdapter, {
    searchDescription: "Search IMDb titles through the public suggestion feed",
    titleDescription: "Load an IMDb title by URL, title ID, or query",
  }),
  examples: [
    'mikacli imdb search "inception"',
    "mikacli imdb title tt1375666",
    "mikacli imdb info https://www.imdb.com/title/tt1375666/",
  ],
};

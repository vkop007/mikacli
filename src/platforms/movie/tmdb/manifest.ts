import { createPublicMovieCapabilities } from "../shared/public-capabilities.js";
import { tmdbAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const tmdbPlatformDefinition: PlatformDefinition = {
  id: "tmdb",
  category: "movie",
  displayName: "TMDb",
  description: "Search public movie and TV titles through TMDb's live web catalog",
  authStrategies: ["none"],
  adapter: tmdbAdapter,
  capabilities: createPublicMovieCapabilities(tmdbAdapter, {
    searchDescription: "Search public TMDb movie and TV titles",
    titleDescription: "Load a TMDb title by URL, numeric movie ID, or query",
    recommendationsDescription: "Load TMDb recommendations for a title",
    trendingDescription: "Load popular TMDb movies from the live catalog",
  }),
  examples: [
    'mikacli tmdb search "inception"',
    "mikacli tmdb title 27205",
    "mikacli tmdb recommendations https://www.themoviedb.org/movie/27205-inception",
    "mikacli tmdb trending --limit 10",
  ],
};

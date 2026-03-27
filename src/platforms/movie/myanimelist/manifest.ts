import { createMovieCapabilities } from "../shared/capabilities.js";
import { myAnimeListAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const myAnimeListPlatformDefinition: PlatformDefinition = {
  id: "myanimelist",
  category: "movie",
  displayName: "MyAnimeList",
  description: "Search anime, inspect titles, and load anime lists using MyAnimeList",
  authStrategies: ["cookies", "none"],
  adapter: myAnimeListAdapter,
  capabilities: createMovieCapabilities(myAnimeListAdapter),
  examples: [
    'autocli myanimelist search "naruto"',
    "autocli myanimelist title 20",
    "autocli myanimelist info https://myanimelist.net/anime/20/Naruto",
    "autocli myanimelist login --cookies ./myanimelist.cookies.json",
    "autocli myanimelist status",
    "autocli myanimelist list Seijuro --status watching --limit 10",
  ],
};

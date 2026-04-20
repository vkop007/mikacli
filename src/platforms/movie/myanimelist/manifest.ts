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
    "mikacli myanimelist login",
    'mikacli myanimelist search "naruto"',
    "mikacli myanimelist title 20",
    "mikacli myanimelist info https://myanimelist.net/anime/20/Naruto",
    "mikacli myanimelist login --cookies ./myanimelist.cookies.json",
    "mikacli myanimelist status",
    "mikacli myanimelist list Seijuro --status watching --limit 10",
  ],
};

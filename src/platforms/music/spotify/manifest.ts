import { spotifyAdapter } from "./adapter.js";
import { spotifyCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const spotifyPlatformDefinition: PlatformDefinition = {
  id: "spotify",
  category: "music",
  displayName: "Spotify",
  description: "Interact with Spotify using an imported browser session",
  authStrategies: ["cookies"],
  adapter: spotifyAdapter,
  capabilities: spotifyCapabilities,
};

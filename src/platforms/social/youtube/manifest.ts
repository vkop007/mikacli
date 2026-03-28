import { youtubeAdapter } from "./adapter.js";
import { youtubeCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const youtubePlatformDefinition: PlatformDefinition = {
  id: "youtube",
  category: "social",
  displayName: "YouTube",
  description: "Interact with YouTube using an imported browser session for public lookup, engagement, and downloads",
  aliases: ["yt"],
  authStrategies: ["cookies"],
  adapter: youtubeAdapter,
  capabilities: youtubeCapabilities,
  examples: [
    "autocli youtube login --cookies ./youtube.cookies.json",
    "autocli youtube download dQw4w9WgXcQ",
    "autocli youtube download dQw4w9WgXcQ --audio-only",
    'autocli youtube search "rick astley"',
    "autocli youtube videoid dQw4w9WgXcQ",
    "autocli youtube channelid @RickAstleyYT",
    "autocli youtube playlistid PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
    "autocli youtube related dQw4w9WgXcQ",
    "autocli youtube captions dQw4w9WgXcQ",
    "autocli youtube like https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "autocli youtube subscribe @RickAstleyYT",
  ],
};

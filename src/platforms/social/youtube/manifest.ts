import { youtubeAdapter } from "./adapter.js";
import { youtubeCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const youtubePlatformDefinition: PlatformDefinition = {
  id: "youtube",
  category: "social",
  displayName: "YouTube",
  description: "Interact with YouTube using an imported browser session for public lookup, engagement, downloads, and Studio uploads",
  aliases: ["yt"],
  authStrategies: ["cookies"],
  adapter: youtubeAdapter,
  capabilities: youtubeCapabilities,
  examples: [
    "autocli social youtube login",
    "autocli social youtube login --cookies ./cookiestest/youtube.json",
    "autocli social youtube upload ./video.mp4 --title \"AutoCLI upload\" --visibility private",
    "autocli social youtube upload ./video.mp4 --title \"AutoCLI upload\" --description \"Uploaded from AutoCLI\" --tags cli,automation --visibility unlisted",
    "autocli social youtube download dQw4w9WgXcQ",
    "autocli social youtube download dQw4w9WgXcQ --audio-only",
    'autocli social youtube search "rick astley"',
    "autocli social youtube videoid dQw4w9WgXcQ",
    "autocli social youtube channelid @RickAstleyYT",
    "autocli social youtube playlistid PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
    "autocli social youtube related dQw4w9WgXcQ",
    "autocli social youtube captions dQw4w9WgXcQ",
    "autocli social youtube like https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "autocli social youtube subscribe @RickAstleyYT",
  ],
};

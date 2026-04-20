import { youtubeAdapter } from "./adapter.js";
import { youtubeCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const youtubePlatformDefinition: PlatformDefinition = {
  id: "youtube",
  category: "social",
  displayName: "YouTube",
  description: "Interact with YouTube using an imported browser session for public lookup, engagement, and Studio uploads. Use `mikacli tools download` for cross-site media downloads.",
  aliases: ["yt"],
  authStrategies: ["cookies"],
  adapter: youtubeAdapter,
  capabilities: youtubeCapabilities,
  examples: [
    "mikacli social youtube login",
    "mikacli social youtube login --cookies ./youtube.cookies.json",
    "mikacli social youtube status",
    "mikacli social youtube post \"Shipping a new video soon\"",
    "mikacli social youtube post \"Sneak peek\" --image ./cover.png",
    "mikacli social youtube delete https://www.youtube.com/post/Ugkx1234567890",
    "mikacli social youtube upload ./video.mp4 --title \"MikaCLI upload\" --visibility private",
    "mikacli social youtube upload ./video.mp4 --title \"MikaCLI upload\" --description \"Uploaded from MikaCLI\" --tags cli,automation --visibility unlisted",
    "mikacli tools download video https://www.youtube.com/watch?v=dQw4w9WgXcQ --platform youtube",
    "mikacli tools download audio https://www.youtube.com/watch?v=dQw4w9WgXcQ --platform youtube --audio-format mp3",
    'mikacli social youtube search "rick astley"',
    "mikacli social youtube videoid dQw4w9WgXcQ",
    "mikacli social youtube channelid @RickAstleyYT",
    "mikacli social youtube playlistid PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
    "mikacli social youtube related dQw4w9WgXcQ",
    "mikacli social youtube captions dQw4w9WgXcQ",
    "mikacli social youtube like https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "mikacli social youtube subscribe @RickAstleyYT",
  ],
};

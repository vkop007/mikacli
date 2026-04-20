import { youtubeMusicAdapter } from "./adapter.js";
import { youtubeMusicCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const youtubeMusicPlatformDefinition: PlatformDefinition = {
  id: "youtube-music",
  category: "music",
  displayName: "YouTube Music",
  description: "Interact with YouTube Music using an imported browser session",
  aliases: ["ytmusic"],
  authStrategies: ["cookies"],
  adapter: youtubeMusicAdapter,
  capabilities: youtubeMusicCapabilities,
  examples: [
    "mikacli youtube-music login",
    "mikacli youtube-music login --cookies ./youtube.cookies.json",
    "mikacli youtube-music play HZbsLxL7GeM",
    "mikacli youtube-music pause",
    "mikacli youtube-music next",
    "mikacli youtube-music queue",
    'mikacli youtube-music search "dandelions"',
    'mikacli youtube-music search "taylor swift" --type artist',
    "mikacli youtube-music songid HZbsLxL7GeM",
    "mikacli youtube-music albumid MPREb_uPJnzIv7Wl1",
    "mikacli youtube-music artistid UCOx12K3GqOMcIeyNTNj1Z6Q",
    "mikacli youtube-music playlistid VLOLAK5uy_n2FuJRR4HTkLC7qK_aQX2Mjx-hW6TI5_k",
    "mikacli youtube-music related HZbsLxL7GeM",
    "mikacli youtube-music like HZbsLxL7GeM",
  ],
};

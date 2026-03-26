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
    "autocli youtube-music login --cookies ./cookiestest/youtube.json",
    "autocli youtube-music play HZbsLxL7GeM",
    "autocli youtube-music pause",
    "autocli youtube-music next",
    "autocli youtube-music queue",
    'autocli youtube-music search "dandelions"',
    'autocli youtube-music search "taylor swift" --type artist',
    "autocli youtube-music songid HZbsLxL7GeM",
    "autocli youtube-music albumid MPREb_uPJnzIv7Wl1",
    "autocli youtube-music artistid UCOx12K3GqOMcIeyNTNj1Z6Q",
    "autocli youtube-music playlistid VLOLAK5uy_n2FuJRR4HTkLC7qK_aQX2Mjx-hW6TI5_k",
    "autocli youtube-music related HZbsLxL7GeM",
    "autocli youtube-music like HZbsLxL7GeM",
  ],
};

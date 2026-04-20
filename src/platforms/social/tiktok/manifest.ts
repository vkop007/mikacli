import { tiktokAdapter } from "./adapter.js";
import { tiktokCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const tiktokPlatformDefinition: PlatformDefinition = {
  id: "tiktok",
  category: "social",
  displayName: "TikTok",
  description: "Interact with TikTok using an imported browser session, with session/read flows strongest today",
  aliases: ["tt"],
  authStrategies: ["cookies"],
  adapter: tiktokAdapter,
  capabilities: tiktokCapabilities,
  examples: [
    "mikacli tiktok login",
    "mikacli tiktok login --cookies ./tiktok.cookies.json",
    'mikacli tiktok post ./clip.mp4 --caption "Posting from MikaCLI"',
    "mikacli tiktok like https://www.tiktok.com/@user/video/7486727777941556488",
  ],
};

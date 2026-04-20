import { facebookAdapter } from "./adapter.js";
import { facebookCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const facebookPlatformDefinition: PlatformDefinition = {
  id: "facebook",
  category: "social",
  displayName: "Facebook",
  description: "Post, like, and comment through browser-backed flows using saved Facebook sessions or the shared MikaCLI browser profile",
  aliases: ["fb"],
  authStrategies: ["cookies"],
  adapter: facebookAdapter,
  capabilities: facebookCapabilities,
  examples: [
    "mikacli social facebook login",
    "mikacli social facebook login --cookies ./facebook.cookies.json",
    "mikacli social facebook status",
    'mikacli social facebook post "Launching from MikaCLI"',
    'mikacli social facebook like "https://www.facebook.com/permalink.php?story_fbid=123&id=456"',
  ],
};

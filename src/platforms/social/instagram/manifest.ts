import { instagramAdapter } from "./adapter.js";
import { instagramCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const instagramPlatformDefinition: PlatformDefinition = {
  id: "instagram",
  category: "social",
  displayName: "Instagram",
  description: "Interact with Instagram using an imported browser session. Use `mikacli tools download` for media downloads.",
  aliases: ["ig"],
  authStrategies: ["cookies"],
  adapter: instagramAdapter,
  capabilities: instagramCapabilities,
  examples: [
    "mikacli social instagram login",
    "mikacli social instagram login --cookies ./instagram.cookies.txt",
    "mikacli social instagram status",
    'mikacli social instagram search "blackpink"',
    "mikacli social instagram mediaid https://www.instagram.com/p/SHORTCODE/",
    "mikacli social instagram profileid @username",
    "mikacli social instagram posts @username",
    "mikacli social instagram stories @username",
    "mikacli social instagram followers @username --limit 5",
    "mikacli social instagram following @username --limit 5",
    "mikacli tools download video https://www.instagram.com/p/SHORTCODE/ --platform instagram",
    "mikacli tools download video https://www.instagram.com/reel/SHORTCODE/ --platform instagram --account default",
    'mikacli social instagram post ./photo.jpg --caption "Ship it"',
    "mikacli social instagram delete https://www.instagram.com/p/SHORTCODE/",
    "mikacli social instagram delete-comment https://www.instagram.com/p/SHORTCODE/ 17900000000000000",
    "mikacli social instagram like https://www.instagram.com/p/SHORTCODE/",
    "mikacli social instagram unlike https://www.instagram.com/p/SHORTCODE/",
    "mikacli social instagram follow @username",
  ],
};

import { facebookAdapter } from "./adapter.js";
import { facebookCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const facebookPlatformDefinition: PlatformDefinition = {
  id: "facebook",
  category: "social",
  displayName: "Facebook",
  description: "Interact with Facebook using an imported browser session, with validation and read flows strongest today",
  aliases: ["fb"],
  authStrategies: ["cookies"],
  adapter: facebookAdapter,
  capabilities: facebookCapabilities,
  examples: [
    "autocli facebook login",
    "autocli facebook login --cookies ./facebook.cookies.json",
    'autocli facebook post "Launching from AutoCLI"',
    "autocli facebook like https://www.facebook.com/permalink.php?story_fbid=456&id=123",
  ],
};

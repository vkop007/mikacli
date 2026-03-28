import { linkedinAdapter } from "./adapter.js";
import { linkedinCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const linkedinPlatformDefinition: PlatformDefinition = {
  id: "linkedin",
  category: "social",
  displayName: "LinkedIn",
  description: "Interact with LinkedIn using an imported browser session, with text posting strongest today",
  aliases: ["li"],
  authStrategies: ["cookies"],
  adapter: linkedinAdapter,
  capabilities: linkedinCapabilities,
  examples: [
    "autocli linkedin login --cookies ./linkedin.cookies.json",
    'autocli linkedin post "Posting from AutoCLI"',
    "autocli linkedin like https://www.linkedin.com/feed/update/urn:li:activity:1234567890123456789/",
  ],
};

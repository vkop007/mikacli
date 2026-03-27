import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { poeAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const poePlatformDefinition: PlatformDefinition = {
  id: "poe",
  category: "llm",
  displayName: "Poe",
  description: "Interact with Poe using imported browser cookies",
  authStrategies: ["cookies"],
  adapter: poeAdapter,
  capabilities: createCookieLlmCapabilities(poeAdapter),
  examples: [
    "autocli poe login --cookies ./poe.cookies.json",
    'autocli poe text "Summarize the strongest CLI UX patterns"',
    'autocli poe text "Draft a crisp launch announcement"',
  ],
};

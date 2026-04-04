import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { mistralAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const mistralPlatformDefinition: PlatformDefinition = {
  id: "mistral",
  category: "llm",
  displayName: "Mistral",
  description: "Interact with Mistral Le Chat using the browserless web flow, with text support strongest today",
  authStrategies: ["cookies"],
  adapter: mistralAdapter,
  capabilities: createCookieLlmCapabilities(mistralAdapter),
  examples: [
    "autocli mistral login",
    "autocli mistral login --cookies ./mistral.cookies.json",
    'autocli mistral text "Draft a concise product changelog"',
    'autocli mistral text "Explain MoE models simply"',
  ],
};

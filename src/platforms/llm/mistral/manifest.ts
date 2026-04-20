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
    "mikacli mistral login",
    "mikacli mistral login --cookies ./mistral.cookies.json",
    'mikacli mistral text "Draft a concise product changelog"',
    'mikacli mistral text "Explain MoE models simply"',
  ],
};

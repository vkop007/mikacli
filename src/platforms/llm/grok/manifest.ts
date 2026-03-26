import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { grokAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const grokPlatformDefinition: PlatformDefinition = {
  id: "grok",
  category: "llm",
  displayName: "Grok",
  description: "Interact with Grok using imported browser cookies",
  authStrategies: ["cookies"],
  adapter: grokAdapter,
  capabilities: createCookieLlmCapabilities(grokAdapter),
  examples: [
    "autocli grok login --cookies ./grok.cookies.json",
    'autocli grok text "Summarize this sprint"',
    'autocli grok video "Cyberpunk city flythrough"',
  ],
};

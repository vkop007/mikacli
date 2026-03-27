import { grokAdapter } from "./adapter.js";
import { createGrokCapabilities } from "./capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const grokPlatformDefinition: PlatformDefinition = {
  id: "grok",
  category: "llm",
  displayName: "Grok",
  description: "Interact with Grok using imported browser cookies",
  authStrategies: ["cookies"],
  adapter: grokAdapter,
  capabilities: createGrokCapabilities(grokAdapter),
  examples: [
    "autocli grok login --cookies ./grok.cookies.json",
    'autocli grok text "Summarize this sprint"',
    'autocli grok image "Minimal orange fox logo on white background"',
    "autocli grok image-download <job-id>",
    'autocli grok video "Cyberpunk city flythrough"',
  ],
};

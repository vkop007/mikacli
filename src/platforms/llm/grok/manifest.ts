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
    "autocli llm grok login",
    "autocli llm grok login --cookies ./grok.cookies.json",
    'autocli llm grok text "Summarize this sprint"',
    'autocli llm grok text "Summarize this sprint" --browser',
    'autocli llm grok image "Minimal orange fox logo on white background" --browser',
    "autocli llm grok image-download <job-id>",
    'autocli llm grok video "Cyberpunk city flythrough" --browser',
  ],
};

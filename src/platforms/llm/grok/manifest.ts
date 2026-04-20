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
    "mikacli llm grok login",
    "mikacli llm grok login --cookies ./grok.cookies.json",
    'mikacli llm grok text "Summarize this sprint"',
    'mikacli llm grok text "Summarize this sprint" --browser',
    'mikacli llm grok image "Minimal orange fox logo on white background" --browser',
    "mikacli llm grok image-download <job-id>",
    'mikacli llm grok video "Cyberpunk city flythrough" --browser',
  ],
};

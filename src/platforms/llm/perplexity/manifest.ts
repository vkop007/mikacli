import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { perplexityAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const perplexityPlatformDefinition: PlatformDefinition = {
  id: "perplexity",
  category: "llm",
  displayName: "Perplexity",
  description: "Interact with Perplexity using imported browser cookies, with text/search flows strongest today",
  authStrategies: ["cookies"],
  adapter: perplexityAdapter,
  capabilities: createCookieLlmCapabilities(perplexityAdapter),
  examples: [
    "autocli perplexity login",
    "autocli perplexity login --cookies ./perplexity.cookies.json",
    'autocli perplexity text "Summarize the latest AI browser trends"',
    'autocli perplexity text "Draft a research brief about agent tooling"',
  ],
};

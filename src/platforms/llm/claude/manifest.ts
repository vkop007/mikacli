import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { claudeAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const claudePlatformDefinition: PlatformDefinition = {
  id: "claude",
  category: "llm",
  displayName: "Claude",
  description: "Interact with Claude using imported browser cookies, with text flows strongest today",
  authStrategies: ["cookies"],
  adapter: claudeAdapter,
  capabilities: createCookieLlmCapabilities(claudeAdapter),
  examples: [
    "autocli claude login --cookies ./claude.cookies.json",
    'autocli claude text "Summarize this changelog"',
    'autocli claude image ./diagram.png --caption "Explain this architecture"',
  ],
};

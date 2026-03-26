import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { zaiAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const zaiPlatformDefinition: PlatformDefinition = {
  id: "zai",
  category: "llm",
  displayName: "Z.ai",
  description: "Interact with Z.ai using imported browser cookies",
  authStrategies: ["cookies"],
  adapter: zaiAdapter,
  capabilities: createCookieLlmCapabilities(zaiAdapter),
  examples: [
    "autocli zai login --cookies ./zai.cookies.json",
    'autocli zai text "Outline a landing page for AutoCLI"',
    'autocli zai video "Minimal product teaser with neon terminal UI"',
  ],
};

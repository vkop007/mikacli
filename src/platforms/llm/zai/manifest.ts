import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { zaiAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const zaiPlatformDefinition: PlatformDefinition = {
  id: "zai",
  category: "llm",
  displayName: "Z.ai",
  description: "Interact with Z.ai using imported browser cookies, with text flows strongest today",
  authStrategies: ["cookies"],
  adapter: zaiAdapter,
  capabilities: createCookieLlmCapabilities(zaiAdapter),
  examples: [
    "mikacli zai login",
    "mikacli zai login --cookies ./zai.cookies.json",
    'mikacli zai text "Outline a landing page for MikaCLI"',
    'mikacli zai video "Minimal product teaser with neon terminal UI"',
  ],
};

import { deepSeekAdapter } from "./adapter.js";
import { createDeepSeekCapabilities } from "./capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const deepSeekPlatformDefinition: PlatformDefinition = {
  id: "deepseek",
  category: "llm",
  displayName: "DeepSeek",
  description: "Interact with DeepSeek using imported browser cookies",
  authStrategies: ["cookies"],
  adapter: deepSeekAdapter,
  capabilities: createDeepSeekCapabilities(deepSeekAdapter),
  examples: [
    "autocli deepseek login --cookies ./deepseek.cookies.json --token <userToken>",
    'autocli deepseek text "Explain vector databases"',
    'autocli llm deepseek text "Draft a short release note"',
  ],
};

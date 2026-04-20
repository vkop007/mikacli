import { deepSeekAdapter } from "./adapter.js";
import { createDeepSeekCapabilities } from "./capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const deepSeekPlatformDefinition: PlatformDefinition = {
  id: "deepseek",
  category: "llm",
  displayName: "DeepSeek",
  description: "Interact with DeepSeek chat using imported browser cookies and optional local userToken",
  authStrategies: ["cookies"],
  adapter: deepSeekAdapter,
  capabilities: createDeepSeekCapabilities(deepSeekAdapter),
  examples: [
    "mikacli deepseek login",
    "mikacli deepseek login --cookies ./deepseek.cookies.json --token <userToken>",
    'mikacli deepseek text "Explain vector databases"',
    'mikacli deepseek text "Draft a short release note"',
  ],
};

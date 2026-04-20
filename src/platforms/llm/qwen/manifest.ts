import { qwenAdapter } from "./adapter.js";
import { createQwenCapabilities } from "./capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const qwenPlatformDefinition: PlatformDefinition = {
  id: "qwen",
  category: "llm",
  displayName: "Qwen",
  description: "Interact with Qwen using imported browser cookies, with optional bearer-token override when the token cookie is missing",
  authStrategies: ["cookies"],
  adapter: qwenAdapter,
  capabilities: createQwenCapabilities(qwenAdapter),
  examples: [
    "mikacli qwen login",
    "mikacli qwen login --cookies ./qwen.cookies.json",
    "mikacli qwen login --cookies ./qwen.cookies.json --token <bearerToken>",
    'mikacli qwen text "Explain retrieval-augmented generation"',
    'mikacli qwen text "Draft a concise launch tweet"',
  ],
};

import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { geminiAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const geminiPlatformDefinition: PlatformDefinition = {
  id: "gemini",
  category: "llm",
  displayName: "Gemini",
  description: "Interact with Gemini using imported browser cookies",
  authStrategies: ["cookies"],
  adapter: geminiAdapter,
  capabilities: createCookieLlmCapabilities(geminiAdapter),
  examples: [
    "autocli gemini login",
    "autocli gemini login --cookies ./gemini.cookies.json",
    'autocli gemini text "Draft a polite follow-up email"',
    'autocli gemini image ./diagram.png --caption "Explain this architecture"',
    'autocli gemini video "A tiny orange fox made of paper blinking softly"',
    "autocli gemini video-download <job-id>",
  ],
};

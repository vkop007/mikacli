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
    "mikacli gemini login",
    "mikacli gemini login --cookies ./gemini.cookies.json",
    'mikacli gemini text "Draft a polite follow-up email"',
    'mikacli gemini image ./diagram.png --caption "Explain this architecture"',
    'mikacli gemini video "A tiny orange fox made of paper blinking softly"',
    "mikacli gemini video-download <job-id>",
  ],
};

import { createCookieLlmCapabilities } from "../shared/capabilities.js";
import { chatgptAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const chatgptPlatformDefinition: PlatformDefinition = {
  id: "chatgpt",
  category: "llm",
  displayName: "ChatGPT",
  description: "Interact with ChatGPT using the browserless web flow, with optional cookie session inspection",
  authStrategies: ["cookies"],
  adapter: chatgptAdapter,
  capabilities: createCookieLlmCapabilities(chatgptAdapter),
  examples: [
    "mikacli chatgpt login",
    "mikacli chatgpt login --cookies ./chatgpt.cookies.json",
    'mikacli chatgpt text "Hello my name is Justine"',
    'mikacli chatgpt image ./photo.png --caption "Gamer portrait"',
  ],
};

import { renderAdapter } from "./adapter.js";
import { renderCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const renderPlatformDefinition: PlatformDefinition = {
  id: "render",
  category: "devops",
  displayName: "Render",
  description: "Inspect Render services, projects, and environment groups with a saved API token",
  authStrategies: ["apiKey"],
  adapter: renderAdapter,
  capabilities: renderCapabilities,
  examples: [
    "mikacli render login --token $RENDER_API_KEY",
    "mikacli render me",
    "mikacli render services",
    "mikacli render projects",
    "mikacli render env-groups",
  ],
};

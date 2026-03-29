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
    "autocli render login --token $RENDER_API_KEY",
    "autocli render me",
    "autocli render services",
    "autocli render projects",
    "autocli render env-groups",
  ],
};

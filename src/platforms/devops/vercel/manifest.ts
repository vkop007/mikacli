import { vercelAdapter } from "./adapter.js";
import { vercelCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const vercelPlatformDefinition: PlatformDefinition = {
  id: "vercel",
  category: "devops",
  displayName: "Vercel",
  description: "Manage Vercel projects and deployments with a saved API token",
  authStrategies: ["apiKey"],
  adapter: vercelAdapter,
  capabilities: vercelCapabilities,
  examples: [
    "mikacli vercel login --token $VERCEL_TOKEN",
    "mikacli vercel me",
    "mikacli vercel teams",
    "mikacli vercel projects",
    "mikacli vercel deployments --project mikacli",
  ],
};

import { railwayAdapter } from "./adapter.js";
import { railwayCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const railwayPlatformDefinition: PlatformDefinition = {
  id: "railway",
  category: "devops",
  displayName: "Railway",
  description: "Inspect Railway account, project, and service data with a saved API token",
  authStrategies: ["apiKey"],
  adapter: railwayAdapter,
  capabilities: railwayCapabilities,
  examples: [
    "mikacli railway login --token $RAILWAY_TOKEN",
    "mikacli railway me",
    "mikacli railway projects",
    "mikacli railway project <project-id>",
    "mikacli railway service <service-id>",
  ],
};

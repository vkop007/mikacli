import { flyAdapter } from "./adapter.js";
import { flyCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const flyPlatformDefinition: PlatformDefinition = {
  id: "fly",
  category: "devops",
  displayName: "Fly.io",
  description: "Inspect Fly Machines apps, machines, volumes, and certificates with a saved API token",
  authStrategies: ["apiKey"],
  adapter: flyAdapter,
  capabilities: flyCapabilities,
  examples: [
    "mikacli fly login --token $FLY_API_TOKEN",
    "mikacli fly apps --org personal",
    "mikacli fly app my-app",
    "mikacli fly machines my-app",
    "mikacli fly certificates my-app",
  ],
};

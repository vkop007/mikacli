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
    "autocli fly login --token $FLY_API_TOKEN",
    "autocli fly apps --org personal",
    "autocli fly app my-app",
    "autocli fly machines my-app",
    "autocli fly certificates my-app",
  ],
};

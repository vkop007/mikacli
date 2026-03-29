import { digitalOceanAdapter } from "./adapter.js";
import { digitalOceanCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const digitalOceanPlatformDefinition: PlatformDefinition = {
  id: "digitalocean",
  category: "devops",
  displayName: "DigitalOcean",
  description: "Inspect DigitalOcean App Platform apps, deployments, and domains with a saved API token",
  authStrategies: ["apiKey"],
  adapter: digitalOceanAdapter,
  capabilities: digitalOceanCapabilities,
  examples: [
    "autocli digitalocean login --token $DIGITALOCEAN_TOKEN",
    "autocli digitalocean me",
    "autocli digitalocean apps",
    "autocli digitalocean deployments my-app",
    "autocli digitalocean domains",
  ],
};

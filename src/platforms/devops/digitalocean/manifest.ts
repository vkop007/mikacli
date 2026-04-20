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
    "mikacli digitalocean login --token $DIGITALOCEAN_TOKEN",
    "mikacli digitalocean me",
    "mikacli digitalocean apps",
    "mikacli digitalocean deployments my-app",
    "mikacli digitalocean domains",
  ],
};

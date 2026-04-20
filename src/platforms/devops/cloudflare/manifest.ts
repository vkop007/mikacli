import { cloudflareAdapter } from "./adapter.js";
import { cloudflareCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const cloudflarePlatformDefinition: PlatformDefinition = {
  id: "cloudflare",
  category: "devops",
  displayName: "Cloudflare",
  description: "Manage Cloudflare zones and DNS with a saved API token",
  authStrategies: ["apiKey"],
  adapter: cloudflareAdapter,
  capabilities: cloudflareCapabilities,
  examples: [
    "mikacli cloudflare login --token $CLOUDFLARE_API_TOKEN",
    "mikacli cloudflare me",
    "mikacli cloudflare accounts",
    "mikacli cloudflare zones",
    "mikacli cloudflare dns example.com",
  ],
};

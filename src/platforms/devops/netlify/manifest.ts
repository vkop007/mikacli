import { netlifyAdapter } from "./adapter.js";
import { netlifyCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const netlifyPlatformDefinition: PlatformDefinition = {
  id: "netlify",
  category: "devops",
  displayName: "Netlify",
  description: "Manage Netlify sites, deploys, and DNS with a saved API token",
  authStrategies: ["apiKey"],
  adapter: netlifyAdapter,
  capabilities: netlifyCapabilities,
  examples: [
    "mikacli netlify login --token $NETLIFY_TOKEN",
    "mikacli netlify me",
    "mikacli netlify accounts",
    "mikacli netlify sites",
    "mikacli netlify deploys --site mikacli",
  ],
};

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
    "autocli netlify login --token $NETLIFY_TOKEN",
    "autocli netlify me",
    "autocli netlify accounts",
    "autocli netlify sites",
    "autocli netlify deploys --site autocli",
  ],
};

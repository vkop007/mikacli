import { linearAdapter } from "./adapter.js";
import { linearCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const linearPlatformDefinition: PlatformDefinition = {
  id: "linear",
  category: "developer",
  displayName: "Linear",
  description: "Use a saved Linear personal API key to inspect teams, projects, and issues",
  authStrategies: ["apiKey"],
  adapter: linearAdapter,
  capabilities: linearCapabilities,
  examples: [
    "autocli linear login --token lin_api_xxx",
    "autocli linear me",
    "autocli linear teams",
    "autocli linear projects",
    "autocli linear issues --team ENG --limit 20",
    "autocli linear issue ENG-123",
    "autocli linear create-issue --team ENG --title \"Bug report\" --description \"Details here\"",
    "autocli linear update-issue ENG-123 --title \"Updated title\"",
    "autocli linear comment ENG-123 --body \"Looks good\"",
  ],
};

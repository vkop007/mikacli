import { linearAdapter } from "./adapter.js";
import { linearCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const linearPlatformDefinition: PlatformDefinition = {
  id: "linear",
  category: "developer",
  displayName: "Linear",
  description: "Use a saved Linear web session to inspect teams, projects, and issues",
  authStrategies: ["cookies"],
  adapter: linearAdapter,
  capabilities: linearCapabilities,
  examples: [
    "autocli linear login",
    "autocli linear login --cookies ./linear.cookies.json",
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

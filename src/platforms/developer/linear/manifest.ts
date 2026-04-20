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
    "mikacli linear login",
    "mikacli linear login --cookies ./linear.cookies.json",
    "mikacli linear me",
    "mikacli linear teams",
    "mikacli linear projects",
    "mikacli linear issues --team ENG --limit 20",
    "mikacli linear issue ENG-123",
    "mikacli linear create-issue --team ENG --title \"Bug report\" --description \"Details here\"",
    "mikacli linear update-issue ENG-123 --title \"Updated title\"",
    "mikacli linear comment ENG-123 --body \"Looks good\"",
  ],
};

import { trelloAdapter } from "./adapter.js";
import { trelloCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const trelloPlatformDefinition: PlatformDefinition = {
  id: "trello",
  category: "developer",
  displayName: "Trello",
  description: "Use a saved Trello web session to inspect boards, lists, and cards",
  authStrategies: ["cookies"],
  adapter: trelloAdapter,
  capabilities: trelloCapabilities,
  examples: [
    "autocli trello login",
    "autocli trello login --cookies ./trello.cookies.json",
    "autocli trello me",
    "autocli trello boards",
    'autocli trello boards "autocli"',
    "autocli trello board https://trello.com/b/yourBoardId/example-board",
    "autocli trello lists https://trello.com/b/yourBoardId/example-board",
    "autocli trello cards https://trello.com/b/yourBoardId/example-board --limit 20",
    "autocli trello card https://trello.com/c/yourCardId/example-card",
    'autocli trello create-card https://trello.com/b/yourBoardId/example-board --list "To Do" --name "Ship AutoCLI"',
  ],
};

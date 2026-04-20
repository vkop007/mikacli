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
    "mikacli trello login",
    "mikacli trello login --cookies ./trello.cookies.json",
    "mikacli trello me",
    "mikacli trello boards",
    'mikacli trello boards "mikacli"',
    "mikacli trello board https://trello.com/b/yourBoardId/example-board",
    "mikacli trello lists https://trello.com/b/yourBoardId/example-board",
    "mikacli trello cards https://trello.com/b/yourBoardId/example-board --limit 20",
    "mikacli trello card https://trello.com/c/yourCardId/example-card",
    'mikacli trello create-card https://trello.com/b/yourBoardId/example-board --list "To Do" --name "Ship MikaCLI"',
  ],
};

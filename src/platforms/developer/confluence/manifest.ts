import { confluenceAdapter } from "./adapter.js";
import { confluenceCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const confluencePlatformDefinition: PlatformDefinition = {
  id: "confluence",
  category: "developer",
  displayName: "Confluence",
  description: "Use a saved Confluence web session to search, inspect, and edit your workspace pages",
  authStrategies: ["cookies"],
  adapter: confluenceAdapter,
  capabilities: confluenceCapabilities,
  examples: [
    "mikacli confluence login --site https://your-workspace.atlassian.net/wiki",
    "mikacli confluence login --cookies ./confluence.cookies.json --site https://your-workspace.atlassian.net/wiki",
    "mikacli confluence me",
    'mikacli confluence search "release process"',
    "mikacli confluence spaces",
    "mikacli confluence page <page-id-or-url>",
    "mikacli confluence children <page-id-or-url> --limit 10",
    'mikacli confluence create-page --space ENG --title "MikaCLI Notes" --body "Shipped from terminal"',
    'mikacli confluence update-page <page-id-or-url> --title "Updated title" --body "Fresh body"',
    'mikacli confluence comment <page-id-or-url> --text "Looks good"',
  ],
};

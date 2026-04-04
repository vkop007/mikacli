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
    "autocli confluence login --site https://your-workspace.atlassian.net/wiki",
    "autocli confluence login --cookies ./confluence.cookies.json --site https://your-workspace.atlassian.net/wiki",
    "autocli confluence me",
    'autocli confluence search "release process"',
    "autocli confluence spaces",
    "autocli confluence page <page-id-or-url>",
    "autocli confluence children <page-id-or-url> --limit 10",
    'autocli confluence create-page --space ENG --title "AutoCLI Notes" --body "Shipped from terminal"',
    'autocli confluence update-page <page-id-or-url> --title "Updated title" --body "Fresh body"',
    'autocli confluence comment <page-id-or-url> --text "Looks good"',
  ],
};

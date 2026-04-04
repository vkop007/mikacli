import { notionAdapter } from "./adapter.js";
import { notionCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const notionPlatformDefinition: PlatformDefinition = {
  id: "notion",
  category: "developer",
  displayName: "Notion",
  description: "Use a saved Notion web session to search, inspect, and edit pages and databases",
  authStrategies: ["cookies"],
  adapter: notionAdapter,
  capabilities: notionCapabilities,
  examples: [
    "autocli notion login",
    "autocli notion login --cookies ./notion.cookies.json",
    "autocli notion me",
    'autocli notion search "roadmap"',
    'autocli notion pages "launch"',
    "autocli notion page <page-id-or-url>",
    'autocli notion create-page --parent <page-or-data-source-id> --title "AutoCLI Notes" --content "Shipped from terminal"',
    'autocli notion update-page <page-id-or-url> --title "Updated title"',
    'autocli notion append <page-id-or-url> --text "Another paragraph"',
    "autocli notion databases",
    "autocli notion database <data-source-id-or-url>",
    "autocli notion query <data-source-id-or-url> --limit 10",
    'autocli notion comment <page-id-or-url> --text "Looks good"',
  ],
};

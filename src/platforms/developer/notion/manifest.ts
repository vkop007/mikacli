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
    "mikacli notion login",
    "mikacli notion login --cookies ./notion.cookies.json",
    "mikacli notion me",
    'mikacli notion search "roadmap"',
    'mikacli notion pages "launch"',
    "mikacli notion page <page-id-or-url>",
    'mikacli notion create-page --parent <page-or-data-source-id> --title "MikaCLI Notes" --content "Shipped from terminal"',
    'mikacli notion update-page <page-id-or-url> --title "Updated title"',
    'mikacli notion append <page-id-or-url> --text "Another paragraph"',
    "mikacli notion databases",
    "mikacli notion database <data-source-id-or-url>",
    "mikacli notion query <data-source-id-or-url> --limit 10",
    'mikacli notion comment <page-id-or-url> --text "Looks good"',
  ],
};

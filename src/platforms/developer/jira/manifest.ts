import { jiraAdapter } from "./adapter.js";
import { jiraCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const jiraPlatformDefinition: PlatformDefinition = {
  id: "jira",
  category: "developer",
  displayName: "Jira",
  description: "Use a saved Jira web session to inspect projects and issues on your workspace site",
  authStrategies: ["cookies"],
  adapter: jiraAdapter,
  capabilities: jiraCapabilities,
  examples: [
    "mikacli jira login --site https://your-workspace.atlassian.net",
    "mikacli jira login --cookies ./jira.cookies.json --site https://your-workspace.atlassian.net",
    "mikacli jira me",
    "mikacli jira projects",
    "mikacli jira project ENG",
    "mikacli jira issues ENG --state open --limit 20",
    'mikacli jira issues --jql "assignee = currentUser() ORDER BY updated DESC"',
    "mikacli jira issue ENG-123",
    'mikacli jira create-issue ENG --summary "Ship MikaCLI" --description "Created from terminal"',
  ],
};

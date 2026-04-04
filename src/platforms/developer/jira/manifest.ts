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
    "autocli jira login --site https://your-workspace.atlassian.net",
    "autocli jira login --cookies ./jira.cookies.json --site https://your-workspace.atlassian.net",
    "autocli jira me",
    "autocli jira projects",
    "autocli jira project ENG",
    "autocli jira issues ENG --state open --limit 20",
    'autocli jira issues --jql "assignee = currentUser() ORDER BY updated DESC"',
    "autocli jira issue ENG-123",
    'autocli jira create-issue ENG --summary "Ship AutoCLI" --description "Created from terminal"',
  ],
};

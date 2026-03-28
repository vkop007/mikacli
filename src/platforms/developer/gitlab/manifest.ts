import { gitlabAdapter } from "./adapter.js";
import { gitlabCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const gitlabPlatformDefinition: PlatformDefinition = {
  id: "gitlab",
  category: "developer",
  displayName: "GitLab",
  description: "Use a saved GitLab web session to inspect projects, issues, and merge requests",
  aliases: ["gl"],
  authStrategies: ["cookies"],
  adapter: gitlabAdapter,
  capabilities: gitlabCapabilities,
  examples: [
    "autocli gitlab login --cookies ./gitlab.cookies.json",
    "autocli gitlab login --cookies ./gitlab.cookies.json --account work",
    "autocli gitlab me",
    'autocli gitlab projects "autocli" --limit 10',
    "autocli gitlab project group/subgroup/project",
    'autocli gitlab search-projects "typescript cli" --limit 10',
    "autocli gitlab issues group/project --state opened --limit 10",
    "autocli gitlab issue group/project 123",
    'autocli gitlab create-issue group/project --title "Bug report" --body "Details here"',
    "autocli gitlab merge-requests group/project --state opened --limit 10",
    "autocli gitlab merge-request group/project 123",
  ],
};

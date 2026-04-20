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
    "mikacli gitlab login",
    "mikacli gitlab login --cookies ./gitlab.cookies.json",
    "mikacli gitlab login --cookies ./gitlab.cookies.json --account work",
    "mikacli gitlab me",
    'mikacli gitlab projects "mikacli" --limit 10',
    "mikacli gitlab project group/subgroup/project",
    'mikacli gitlab search-projects "typescript cli" --limit 10',
    "mikacli gitlab issues group/project --state opened --limit 10",
    "mikacli gitlab issue group/project 123",
    'mikacli gitlab create-issue group/project --title "Bug report" --body "Details here"',
    "mikacli gitlab merge-requests group/project --state opened --limit 10",
    "mikacli gitlab merge-request group/project 123",
  ],
};

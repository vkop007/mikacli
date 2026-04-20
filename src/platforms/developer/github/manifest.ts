import { githubAdapter } from "./adapter.js";
import { githubCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const githubPlatformDefinition: PlatformDefinition = {
  id: "github",
  category: "developer",
  displayName: "GitHub",
  description: "Use a saved GitHub web session to inspect repos, issues, and repository metadata",
  aliases: ["gh"],
  authStrategies: ["cookies"],
  adapter: githubAdapter,
  capabilities: githubCapabilities,
  examples: [
    "mikacli github login",
    "mikacli github login --cookies ./github.cookies.json",
    "mikacli github me",
    "mikacli github user torvalds",
    "mikacli github repos",
    "mikacli github repos openai --limit 10",
    "mikacli github repo openai/openai-node",
    'mikacli github search-repos "typescript cli" --limit 10',
    "mikacli github starred",
    "mikacli github branches openai/openai-node",
    "mikacli github pulls openai/openai-node --state open --limit 10",
    "mikacli github releases openai/openai-node --limit 5",
    "mikacli github readme openai/openai-node",
    "mikacli github issues openai/openai-node --state open --limit 10",
    'mikacli github create-issue owner/repo --title "Bug report" --body "Details here"',
    'mikacli github comment owner/repo 123 --body "Looks good to me"',
    "mikacli github create-repo mikacli-playground --private --auto-init",
    "mikacli github fork openai/openai-node",
    "mikacli github star openai/openai-node",
  ],
};

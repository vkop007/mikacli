import { githubAdapter } from "./adapter.js";
import { githubCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const githubPlatformDefinition: PlatformDefinition = {
  id: "github",
  category: "developer",
  displayName: "GitHub",
  description: "Use a saved GitHub personal access token to inspect repos, issues, and repository metadata",
  aliases: ["gh"],
  authStrategies: ["apiKey"],
  adapter: githubAdapter,
  capabilities: githubCapabilities,
  examples: [
    "autocli github login --token github_pat_xxx",
    "autocli github me",
    "autocli github user torvalds",
    "autocli github repos",
    "autocli github repos openai --limit 10",
    "autocli github repo openai/openai-node",
    'autocli github search-repos "typescript cli" --limit 10',
    "autocli github starred",
    "autocli github branches openai/openai-node",
    "autocli github pulls openai/openai-node --state open --limit 10",
    "autocli github releases openai/openai-node --limit 5",
    "autocli github readme openai/openai-node",
    "autocli github issues openai/openai-node --state open --limit 10",
    'autocli github create-issue owner/repo --title "Bug report" --body "Details here"',
    'autocli github comment owner/repo 123 --body "Looks good to me"',
    "autocli github create-repo autocli-playground --private --auto-init",
    "autocli github fork openai/openai-node",
    "autocli github star openai/openai-node",
  ],
};

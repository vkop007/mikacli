import { githubBotAdapter } from "../../github/adapter.js";
import { createGitHubCapabilities } from "../../github/capabilities/index.js";

import type { PlatformDefinition } from "../../../../core/runtime/platform-definition.js";

export const githubbotPlatformDefinition: PlatformDefinition = {
  id: "githubbot",
  category: "api",
  displayName: "GitHub Bot",
  description: "Use a saved GitHub App or bot token to inspect repos, issues, pull requests, and repository metadata",
  aliases: ["ghbot"],
  authStrategies: ["apiKey"],
  adapter: githubBotAdapter,
  capabilities: createGitHubCapabilities(githubBotAdapter),
  examples: [
    "autocli githubbot login --token <github-app-or-bot-token>",
    "autocli githubbot me",
    "autocli githubbot user openai",
    "autocli githubbot repos",
    "autocli githubbot repo openai/openai-node",
    'autocli githubbot search-repos "typescript cli" --limit 10',
    "autocli githubbot issues openai/openai-node --state open --limit 10",
    "autocli githubbot pulls openai/openai-node --state open --limit 10",
    "autocli githubbot releases openai/openai-node --limit 5",
    "autocli githubbot readme openai/openai-node",
    'autocli githubbot create-issue owner/repo --title "Bug report" --body "Details here"',
    'autocli githubbot comment owner/repo 123 --body "Looks good to me"',
    "autocli githubbot fork openai/openai-node",
    "autocli githubbot star openai/openai-node",
  ],
};

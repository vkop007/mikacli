import { githubBotAdapter } from "../../developer/github/adapter.js";
import { createGitHubCapabilities } from "../../developer/github/capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const githubbotPlatformDefinition: PlatformDefinition = {
  id: "githubbot",
  category: "bot",
  displayName: "GitHub Bot",
  description: "Use a saved GitHub App or bot token to inspect repos, issues, pull requests, and repository metadata",
  aliases: ["ghbot"],
  authStrategies: ["apiKey"],
  adapter: githubBotAdapter,
  capabilities: createGitHubCapabilities(githubBotAdapter),
  examples: [
    "mikacli githubbot login --token <github-app-or-bot-token>",
    "mikacli githubbot me",
    "mikacli githubbot user openai",
    "mikacli githubbot repos",
    "mikacli githubbot repo openai/openai-node",
    'mikacli githubbot search-repos "typescript cli" --limit 10',
    "mikacli githubbot issues openai/openai-node --state open --limit 10",
    "mikacli githubbot pulls openai/openai-node --state open --limit 10",
    "mikacli githubbot releases openai/openai-node --limit 5",
    "mikacli githubbot readme openai/openai-node",
    'mikacli githubbot create-issue owner/repo --title "Bug report" --body "Details here"',
    'mikacli githubbot comment owner/repo 123 --body "Looks good to me"',
    "mikacli githubbot fork openai/openai-node",
    "mikacli githubbot star openai/openai-node",
  ],
};

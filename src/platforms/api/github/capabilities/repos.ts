import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubRepoResult, printGitHubReposResult } from "../output.js";

export const githubReposCapability = createAdapterActionCapability({
  id: "repos",
  command: "repos [owner]",
  description: "List GitHub repositories for the authenticated account or for a public owner",
  spinnerText: "Loading GitHub repositories...",
  successMessage: "GitHub repositories loaded.",
  options: [
    { flags: "--limit <number>", description: "Maximum repositories to load (default: 30)", parser: parsePositiveInteger },
    { flags: "--sort <value>", description: "Sort order: created, updated, pushed, full_name" },
    { flags: "--type <value>", description: "Authenticated repo type: all, owner, public, private, member" },
  ],
  action: ({ args, options }) =>
    githubAdapter.repos({
      owner: args[0] ? String(args[0]) : undefined,
      limit: options.limit as number | undefined,
      sort: options.sort as string | undefined,
      type: options.type as string | undefined,
    }),
  onSuccess: printGitHubReposResult,
});

export const githubRepoCapability = createAdapterActionCapability({
  id: "repo",
  command: "repo <target>",
  description: "Load a single GitHub repository by owner/repo or GitHub URL",
  spinnerText: "Loading GitHub repository...",
  successMessage: "GitHub repository loaded.",
  action: ({ args, options }) =>
    githubAdapter.repo({
      target: String(args[0] ?? ""),
    }),
  onSuccess: printGitHubRepoResult,
});

export const githubSearchReposCapability = createAdapterActionCapability({
  id: "search-repos",
  command: "search-repos <query>",
  aliases: ["search"],
  description: "Search GitHub repositories",
  spinnerText: "Searching GitHub repositories...",
  successMessage: "GitHub repository search completed.",
  options: [
    { flags: "--limit <number>", description: "Maximum repositories to return (default: 20)", parser: parsePositiveInteger },
    { flags: "--sort <value>", description: "Sort search results by stars, forks, help-wanted-issues, updated" },
    { flags: "--order <value>", description: "Sort order: desc or asc" },
  ],
  action: ({ args, options }) =>
    githubAdapter.searchRepos({
      query: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      sort: options.sort as string | undefined,
      order: options.order as string | undefined,
    }),
  onSuccess: printGitHubReposResult,
});

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

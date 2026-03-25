import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubCommentResult, printGitHubReadmeResult, printGitHubReleasesResult, printGitHubRepoResult, printGitHubReposResult } from "../output.js";

export const githubStarredCapability = createAdapterActionCapability({
  id: "starred",
  command: "starred [owner]",
  description: "List starred GitHub repositories for the authenticated account or a public user",
  spinnerText: "Loading starred GitHub repositories...",
  successMessage: "Starred GitHub repositories loaded.",
  options: [
    { flags: "--limit <number>", description: "Maximum repositories to load (default: 30)", parser: parsePositiveInteger },
    { flags: "--sort <value>", description: "Sort order: created or updated" },
    { flags: "--direction <value>", description: "Direction: asc or desc" },
  ],
  action: ({ args, options }) =>
    githubAdapter.starred({
      owner: args[0] ? String(args[0]) : undefined,
      limit: options.limit as number | undefined,
      sort: options.sort as string | undefined,
      direction: options.direction as string | undefined,
    }),
  onSuccess: printGitHubReposResult,
});

export const githubReleasesCapability = createAdapterActionCapability({
  id: "releases",
  command: "releases <repo>",
  description: "List releases for a GitHub repository",
  spinnerText: "Loading GitHub releases...",
  successMessage: "GitHub releases loaded.",
  options: [{ flags: "--limit <number>", description: "Maximum releases to load (default: 20)", parser: parsePositiveInteger }],
  action: ({ args, options }) =>
    githubAdapter.releases({
      repo: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printGitHubReleasesResult,
});

export const githubReadmeCapability = createAdapterActionCapability({
  id: "readme",
  command: "readme <repo>",
  description: "Load and decode the README from a GitHub repository",
  spinnerText: "Loading GitHub README...",
  successMessage: "GitHub README loaded.",
  action: ({ args }) =>
    githubAdapter.readme({
      repo: String(args[0] ?? ""),
    }),
  onSuccess: printGitHubReadmeResult,
});

export const githubCommentCapability = createAdapterActionCapability({
  id: "comment",
  command: "comment <repo> <number>",
  description: "Add a comment to a GitHub issue",
  spinnerText: "Creating GitHub comment...",
  successMessage: "GitHub comment created.",
  options: [{ flags: "--body <text>", description: "Comment body markdown", required: true }],
  action: ({ args, options }) =>
    githubAdapter.comment({
      repo: String(args[0] ?? ""),
      number: parsePositiveInteger(String(args[1] ?? "")),
      body: String(options.body ?? ""),
    }),
  onSuccess: printGitHubCommentResult,
});

export const githubForkCapability = createAdapterActionCapability({
  id: "fork",
  command: "fork <repo>",
  description: "Create a fork of a GitHub repository",
  spinnerText: "Creating GitHub fork...",
  successMessage: "GitHub fork created.",
  action: ({ args }) =>
    githubAdapter.fork({
      repo: String(args[0] ?? ""),
    }),
  onSuccess: printGitHubRepoResult,
});

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

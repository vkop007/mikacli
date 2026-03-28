import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubCommentResult, printGitHubReadmeResult, printGitHubReleasesResult, printGitHubRepoResult, printGitHubReposResult } from "../output.js";

export function createGitHubStarredCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "starred",
    command: "starred [owner]",
    description: `List starred ${adapter.displayName} repositories for the authenticated account or a public user`,
    spinnerText: `Loading starred ${adapter.displayName} repositories...`,
    successMessage: `Starred ${adapter.displayName} repositories loaded.`,
    options: [
      { flags: "--limit <number>", description: "Maximum repositories to load (default: 30)", parser: parsePositiveInteger },
      { flags: "--sort <value>", description: "Sort order: created or updated" },
      { flags: "--direction <value>", description: "Direction: asc or desc" },
    ],
    action: ({ args, options }) =>
      adapter.starred({
        owner: args[0] ? String(args[0]) : undefined,
        limit: options.limit as number | undefined,
        sort: options.sort as string | undefined,
        direction: options.direction as string | undefined,
      }),
    onSuccess: printGitHubReposResult,
  });
}

export function createGitHubReleasesCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "releases",
    command: "releases <repo>",
    description: `List releases for a ${adapter.displayName} repository`,
    spinnerText: `Loading ${adapter.displayName} releases...`,
    successMessage: `${adapter.displayName} releases loaded.`,
    options: [{ flags: "--limit <number>", description: "Maximum releases to load (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.releases({
        repo: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printGitHubReleasesResult,
  });
}

export function createGitHubReadmeCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "readme",
    command: "readme <repo>",
    description: `Load and decode the README from a ${adapter.displayName} repository`,
    spinnerText: `Loading ${adapter.displayName} README...`,
    successMessage: `${adapter.displayName} README loaded.`,
    action: ({ args }) =>
      adapter.readme({
        repo: String(args[0] ?? ""),
      }),
    onSuccess: printGitHubReadmeResult,
  });
}

export function createGitHubCommentCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "comment",
    command: "comment <repo> <number>",
    description: `Add a comment to a ${adapter.displayName} issue`,
    spinnerText: `Creating ${adapter.displayName} comment...`,
    successMessage: `${adapter.displayName} comment created.`,
    options: [{ flags: "--body <text>", description: "Comment body markdown", required: true }],
    action: ({ args, options }) =>
      adapter.comment({
        repo: String(args[0] ?? ""),
        number: parsePositiveInteger(String(args[1] ?? "")),
        body: String(options.body ?? ""),
      }),
    onSuccess: printGitHubCommentResult,
  });
}

export function createGitHubForkCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "fork",
    command: "fork <repo>",
    description: `Create a fork of a ${adapter.displayName} repository`,
    spinnerText: `Creating ${adapter.displayName} fork...`,
    successMessage: `${adapter.displayName} fork created.`,
    action: ({ args }) =>
      adapter.fork({
        repo: String(args[0] ?? ""),
      }),
    onSuccess: printGitHubRepoResult,
  });
}

export const githubStarredCapability = createGitHubStarredCapability(githubAdapter);
export const githubReleasesCapability = createGitHubReleasesCapability(githubAdapter);
export const githubReadmeCapability = createGitHubReadmeCapability(githubAdapter);
export const githubCommentCapability = createGitHubCommentCapability(githubAdapter);
export const githubForkCapability = createGitHubForkCapability(githubAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubBranchResult, printGitHubBranchesResult } from "../output.js";

export function createGitHubBranchesCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "branches",
    command: "branches <repo>",
    description: `List branches for a ${adapter.displayName} repository`,
    spinnerText: `Loading ${adapter.displayName} branches...`,
    successMessage: `${adapter.displayName} branches loaded.`,
    options: [{ flags: "--limit <number>", description: "Maximum branches to load (default: 30)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.branches({
        repo: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printGitHubBranchesResult,
  });
}

export function createGitHubBranchCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "branch",
    command: "branch <repo> <branch>",
    description: `Load a single branch for a ${adapter.displayName} repository`,
    spinnerText: `Loading ${adapter.displayName} branch...`,
    successMessage: `${adapter.displayName} branch loaded.`,
    action: ({ args }) =>
      adapter.branch({
        repo: String(args[0] ?? ""),
        branch: String(args[1] ?? ""),
      }),
    onSuccess: printGitHubBranchResult,
  });
}

export const githubBranchesCapability = createGitHubBranchesCapability(githubAdapter);
export const githubBranchCapability = createGitHubBranchCapability(githubAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

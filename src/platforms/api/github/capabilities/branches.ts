import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubBranchResult, printGitHubBranchesResult } from "../output.js";

export const githubBranchesCapability = createAdapterActionCapability({
  id: "branches",
  command: "branches <repo>",
  description: "List branches for a GitHub repository",
  spinnerText: "Loading GitHub branches...",
  successMessage: "GitHub branches loaded.",
  options: [{ flags: "--limit <number>", description: "Maximum branches to load (default: 30)", parser: parsePositiveInteger }],
  action: ({ args, options }) =>
    githubAdapter.branches({
      repo: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printGitHubBranchesResult,
});

export const githubBranchCapability = createAdapterActionCapability({
  id: "branch",
  command: "branch <repo> <branch>",
  description: "Load a single branch for a GitHub repository",
  spinnerText: "Loading GitHub branch...",
  successMessage: "GitHub branch loaded.",
  action: ({ args }) =>
    githubAdapter.branch({
      repo: String(args[0] ?? ""),
      branch: String(args[1] ?? ""),
    }),
  onSuccess: printGitHubBranchResult,
});

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

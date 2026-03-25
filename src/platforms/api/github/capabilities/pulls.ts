import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubPullResult, printGitHubPullsResult } from "../output.js";

export const githubPullsCapability = createAdapterActionCapability({
  id: "pulls",
  command: "pulls <repo>",
  description: "List pull requests for a GitHub repository",
  spinnerText: "Loading GitHub pull requests...",
  successMessage: "GitHub pull requests loaded.",
  options: [
    { flags: "--state <value>", description: "Pull request state: open, closed, all" },
    { flags: "--limit <number>", description: "Maximum pull requests to load (default: 20)", parser: parsePositiveInteger },
    { flags: "--sort <value>", description: "Sort order: created, updated, popularity, long-running" },
    { flags: "--direction <value>", description: "Direction: asc or desc" },
  ],
  action: ({ args, options }) =>
    githubAdapter.pulls({
      repo: String(args[0] ?? ""),
      state: options.state as string | undefined,
      limit: options.limit as number | undefined,
      sort: options.sort as string | undefined,
      direction: options.direction as string | undefined,
    }),
  onSuccess: printGitHubPullsResult,
});

export const githubPullCapability = createAdapterActionCapability({
  id: "pull",
  command: "pull <repo> <number>",
  description: "Load a single GitHub pull request",
  spinnerText: "Loading GitHub pull request...",
  successMessage: "GitHub pull request loaded.",
  action: ({ args }) =>
    githubAdapter.pull({
      repo: String(args[0] ?? ""),
      number: parsePositiveInteger(String(args[1] ?? "")),
    }),
  onSuccess: printGitHubPullResult,
});

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

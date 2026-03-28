import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { gitlabAdapter, type GitLabAdapter } from "../adapter.js";
import { printGitLabMergeRequestResult, printGitLabMergeRequestsResult } from "../output.js";

export function createGitLabMergeRequestsCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "merge-requests",
    command: "merge-requests <project>",
    description: `List merge requests for a ${adapter.displayName} project`,
    spinnerText: `Loading ${adapter.displayName} merge requests...`,
    successMessage: `${adapter.displayName} merge requests loaded.`,
    options: [
      { flags: "--state <value>", description: "Merge request state: opened, closed, locked, all" },
      { flags: "--limit <number>", description: "Maximum merge requests to load (default: 20)", parser: parsePositiveInteger },
    ],
    action: ({ args, options }) =>
      adapter.mergeRequests({
        project: String(args[0] ?? ""),
        state: options.state as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printGitLabMergeRequestsResult,
  });
}

export function createGitLabMergeRequestCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "merge-request",
    command: "merge-request <project> <iid>",
    description: `Load a single ${adapter.displayName} merge request`,
    spinnerText: `Loading ${adapter.displayName} merge request...`,
    successMessage: `${adapter.displayName} merge request loaded.`,
    action: ({ args }) =>
      adapter.mergeRequest({
        project: String(args[0] ?? ""),
        iid: parsePositiveInteger(String(args[1] ?? "")),
      }),
    onSuccess: printGitLabMergeRequestResult,
  });
}

export const gitlabMergeRequestsCapability = createGitLabMergeRequestsCapability(gitlabAdapter);
export const gitlabMergeRequestCapability = createGitLabMergeRequestCapability(gitlabAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}


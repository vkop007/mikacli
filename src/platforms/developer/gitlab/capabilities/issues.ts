import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { gitlabAdapter, type GitLabAdapter } from "../adapter.js";
import { printGitLabIssueResult, printGitLabIssuesResult } from "../output.js";

export function createGitLabIssuesCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "issues",
    command: "issues <project>",
    description: `List issues for a ${adapter.displayName} project`,
    spinnerText: `Loading ${adapter.displayName} issues...`,
    successMessage: `${adapter.displayName} issues loaded.`,
    options: [
      { flags: "--state <value>", description: "Issue state: opened, closed, all" },
      { flags: "--limit <number>", description: "Maximum issues to load (default: 20)", parser: parsePositiveInteger },
    ],
    action: ({ args, options }) =>
      adapter.issues({
        project: String(args[0] ?? ""),
        state: options.state as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printGitLabIssuesResult,
  });
}

export function createGitLabIssueCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "issue",
    command: "issue <project> <iid>",
    description: `Load a single ${adapter.displayName} issue`,
    spinnerText: `Loading ${adapter.displayName} issue...`,
    successMessage: `${adapter.displayName} issue loaded.`,
    action: ({ args }) =>
      adapter.issue({
        project: String(args[0] ?? ""),
        iid: parsePositiveInteger(String(args[1] ?? "")),
      }),
    onSuccess: printGitLabIssueResult,
  });
}

export function createGitLabCreateIssueCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "create-issue",
    command: "create-issue <project>",
    description: `Create a ${adapter.displayName} issue in a project you can write to`,
    spinnerText: `Creating ${adapter.displayName} issue...`,
    successMessage: `${adapter.displayName} issue created.`,
    options: [
      { flags: "--title <text>", description: "Issue title", required: true },
      { flags: "--body <text>", description: "Issue description markdown" },
    ],
    action: ({ args, options }) =>
      adapter.createIssue({
        project: String(args[0] ?? ""),
        title: String(options.title ?? ""),
        body: options.body as string | undefined,
      }),
    onSuccess: printGitLabIssueResult,
  });
}

export const gitlabIssuesCapability = createGitLabIssuesCapability(gitlabAdapter);
export const gitlabIssueCapability = createGitLabIssueCapability(gitlabAdapter);
export const gitlabCreateIssueCapability = createGitLabCreateIssueCapability(gitlabAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}


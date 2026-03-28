import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubIssueResult, printGitHubIssuesResult, printGitHubRepoResult } from "../output.js";

export function createGitHubIssuesCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "issues",
    command: "issues <repo>",
    description: `List issues for a ${adapter.displayName} repository`,
    spinnerText: `Loading ${adapter.displayName} issues...`,
    successMessage: `${adapter.displayName} issues loaded.`,
    options: [
      { flags: "--state <value>", description: "Issue state: open, closed, all" },
      { flags: "--limit <number>", description: "Maximum issues to load (default: 20)", parser: parsePositiveInteger },
    ],
    action: ({ args, options }) =>
      adapter.issues({
        repo: String(args[0] ?? ""),
        state: options.state as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printGitHubIssuesResult,
  });
}

export function createGitHubIssueCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "issue",
    command: "issue <repo> <number>",
    description: `Load a single ${adapter.displayName} issue`,
    spinnerText: `Loading ${adapter.displayName} issue...`,
    successMessage: `${adapter.displayName} issue loaded.`,
    action: ({ args }) =>
      adapter.issue({
        repo: String(args[0] ?? ""),
        number: parsePositiveInteger(String(args[1] ?? "")),
      }),
    onSuccess: printGitHubIssueResult,
  });
}

export function createGitHubCreateIssueCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "create-issue",
    command: "create-issue <repo>",
    description: `Create a ${adapter.displayName} issue in a repository you can write to`,
    spinnerText: `Creating ${adapter.displayName} issue...`,
    successMessage: `${adapter.displayName} issue created.`,
    options: [
      { flags: "--title <text>", description: "Issue title", required: true },
      { flags: "--body <text>", description: "Issue body markdown" },
    ],
    action: ({ args, options }) =>
      adapter.createIssue({
        repo: String(args[0] ?? ""),
        title: String(options.title ?? ""),
        body: options.body as string | undefined,
      }),
    onSuccess: printGitHubIssueResult,
  });
}

export function createGitHubCreateRepoCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "create-repo",
    command: "create-repo <name>",
    description: `Create a new repository for the authenticated ${adapter.displayName} account`,
    spinnerText: `Creating ${adapter.displayName} repository...`,
    successMessage: `${adapter.displayName} repository created.`,
    options: [
      { flags: "--description <text>", description: "Repository description" },
      { flags: "--homepage <url>", description: "Repository homepage URL" },
      { flags: "--private", description: "Create the repository as private" },
      { flags: "--auto-init", description: "Initialize the repository with a README" },
    ],
    action: ({ args, options }) =>
      adapter.createRepo({
        name: String(args[0] ?? ""),
        description: options.description as string | undefined,
        homepage: options.homepage as string | undefined,
        private: Boolean(options.private),
        autoInit: Boolean(options.autoInit),
      }),
    onSuccess: printGitHubRepoResult,
  });
}

export const githubIssuesCapability = createGitHubIssuesCapability(githubAdapter);
export const githubIssueCapability = createGitHubIssueCapability(githubAdapter);
export const githubCreateIssueCapability = createGitHubCreateIssueCapability(githubAdapter);
export const githubCreateRepoCapability = createGitHubCreateRepoCapability(githubAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

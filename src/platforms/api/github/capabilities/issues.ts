import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubIssueResult, printGitHubIssuesResult, printGitHubRepoResult } from "../output.js";

export const githubIssuesCapability = createAdapterActionCapability({
  id: "issues",
  command: "issues <repo>",
  description: "List issues for a GitHub repository",
  spinnerText: "Loading GitHub issues...",
  successMessage: "GitHub issues loaded.",
  options: [
    { flags: "--state <value>", description: "Issue state: open, closed, all" },
    { flags: "--limit <number>", description: "Maximum issues to load (default: 20)", parser: parsePositiveInteger },
  ],
  action: ({ args, options }) =>
    githubAdapter.issues({
      repo: String(args[0] ?? ""),
      state: options.state as string | undefined,
      limit: options.limit as number | undefined,
    }),
  onSuccess: printGitHubIssuesResult,
});

export const githubIssueCapability = createAdapterActionCapability({
  id: "issue",
  command: "issue <repo> <number>",
  description: "Load a single GitHub issue",
  spinnerText: "Loading GitHub issue...",
  successMessage: "GitHub issue loaded.",
  action: ({ args, options }) =>
    githubAdapter.issue({
      repo: String(args[0] ?? ""),
      number: parsePositiveInteger(String(args[1] ?? "")),
    }),
  onSuccess: printGitHubIssueResult,
});

export const githubCreateIssueCapability = createAdapterActionCapability({
  id: "create-issue",
  command: "create-issue <repo>",
  description: "Create a GitHub issue in a repository you can write to",
  spinnerText: "Creating GitHub issue...",
  successMessage: "GitHub issue created.",
  options: [
    { flags: "--title <text>", description: "Issue title", required: true },
    { flags: "--body <text>", description: "Issue body markdown" },
  ],
  action: ({ args, options }) =>
    githubAdapter.createIssue({
      repo: String(args[0] ?? ""),
      title: String(options.title ?? ""),
      body: options.body as string | undefined,
    }),
  onSuccess: printGitHubIssueResult,
});

export const githubCreateRepoCapability = createAdapterActionCapability({
  id: "create-repo",
  command: "create-repo <name>",
  description: "Create a new repository for the authenticated GitHub account",
  spinnerText: "Creating GitHub repository...",
  successMessage: "GitHub repository created.",
  options: [
    { flags: "--description <text>", description: "Repository description" },
    { flags: "--homepage <url>", description: "Repository homepage URL" },
    { flags: "--private", description: "Create the repository as private" },
    { flags: "--auto-init", description: "Initialize the repository with a README" },
  ],
  action: ({ args, options }) =>
    githubAdapter.createRepo({
      name: String(args[0] ?? ""),
      description: options.description as string | undefined,
      homepage: options.homepage as string | undefined,
      private: Boolean(options.private),
      autoInit: Boolean(options.autoInit),
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

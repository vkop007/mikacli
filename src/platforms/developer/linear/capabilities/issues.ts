import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearIssueResult, printLinearIssuesResult } from "../output.js";
import { parsePositiveInteger } from "./limits.js";

export function createLinearIssuesCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "issues",
    command: "issues",
    description: "List Linear issues",
    spinnerText: "Loading Linear issues...",
    successMessage: "Linear issues loaded.",
    options: [
      { flags: "--team <team-id-or-key>", description: "Filter issues by team id, key, or name" },
      { flags: "--limit <number>", description: "Maximum issues to return (default: 20)", parser: parsePositiveInteger },
    ],
    action: ({ options }) =>
      adapter.issues({
        team: options.team as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printLinearIssuesResult,
  });
}

export function createLinearIssueCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "issue",
    command: "issue <id-or-key>",
    description: "Load a single Linear issue by id, issue key, or issue URL",
    spinnerText: "Loading Linear issue...",
    successMessage: "Linear issue loaded.",
    action: ({ args }) =>
      adapter.issue(String(args[0] ?? "")),
    onSuccess: printLinearIssueResult,
  });
}

export function createLinearCreateIssueCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "create-issue",
    command: "create-issue",
    description: "Create a new Linear issue in a team",
    spinnerText: "Creating Linear issue...",
    successMessage: "Linear issue created.",
    options: [
      { flags: "--team <team-id-or-key>", description: "Target team id, key, or name", required: true },
      { flags: "--title <text>", description: "Issue title", required: true },
      { flags: "--description <text>", description: "Issue description markdown" },
    ],
    action: ({ options }) =>
      adapter.createIssue({
        team: String(options.team ?? ""),
        title: String(options.title ?? ""),
        description: options.description as string | undefined,
      }),
    onSuccess: printLinearIssueResult,
  });
}

export function createLinearUpdateIssueCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "update-issue",
    command: "update-issue <id-or-key>",
    description: "Update a Linear issue title, description, or state",
    spinnerText: "Updating Linear issue...",
    successMessage: "Linear issue updated.",
    options: [
      { flags: "--title <text>", description: "New issue title" },
      { flags: "--description <text>", description: "New issue description markdown" },
      { flags: "--state-id <id>", description: "Move the issue to a different state" },
    ],
    action: ({ args, options }) =>
      adapter.updateIssue({
        target: String(args[0] ?? ""),
        title: options.title as string | undefined,
        description: options.description as string | undefined,
        stateId: options.stateId as string | undefined,
      }),
    onSuccess: printLinearIssueResult,
  });
}

export const linearIssuesCapability = createLinearIssuesCapability(linearAdapter);
export const linearIssueCapability = createLinearIssueCapability(linearAdapter);
export const linearCreateIssueCapability = createLinearCreateIssueCapability(linearAdapter);
export const linearUpdateIssueCapability = createLinearUpdateIssueCapability(linearAdapter);


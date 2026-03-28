import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { jiraAdapter, type JiraAdapter } from "../adapter.js";
import { printJiraIssueResult, printJiraIssuesResult } from "../output.js";

export function createJiraIssuesCapability(adapter: JiraAdapter) {
  return createAdapterActionCapability({
    id: "issues",
    command: "issues [project]",
    description: `List ${adapter.displayName} issues for a project or JQL query`,
    spinnerText: `Loading ${adapter.displayName} issues...`,
    successMessage: `${adapter.displayName} issues loaded.`,
    options: [
      { flags: "--jql <query>", description: "Explicit JQL query instead of a project filter" },
      { flags: "--state <value>", description: "Convenience filter when using project mode: open, closed, all" },
      { flags: "--limit <number>", description: "Maximum issues to load (default: 20)", parser: parsePositiveInteger },
    ],
    action: ({ args, options }) =>
      adapter.issues({
        project: args[0] ? String(args[0]) : undefined,
        jql: options.jql as string | undefined,
        state: options.state as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printJiraIssuesResult,
  });
}

export function createJiraIssueCapability(adapter: JiraAdapter) {
  return createAdapterActionCapability({
    id: "issue",
    command: "issue <target>",
    description: `Load a single ${adapter.displayName} issue by key or URL`,
    spinnerText: `Loading ${adapter.displayName} issue...`,
    successMessage: `${adapter.displayName} issue loaded.`,
    action: ({ args }) => adapter.issue(String(args[0] ?? "")),
    onSuccess: printJiraIssueResult,
  });
}

export function createJiraCreateIssueCapability(adapter: JiraAdapter) {
  return createAdapterActionCapability({
    id: "create-issue",
    command: "create-issue <project>",
    description: `Create a ${adapter.displayName} issue in a project you can write to`,
    spinnerText: `Creating ${adapter.displayName} issue...`,
    successMessage: `${adapter.displayName} issue created.`,
    options: [
      { flags: "--summary <text>", description: "Issue summary", required: true },
      { flags: "--description <text>", description: "Issue description" },
      { flags: "--type <name>", description: "Preferred issue type name, like Task or Bug" },
    ],
    action: ({ args, options }) =>
      adapter.createIssue({
        project: String(args[0] ?? ""),
        summary: String(options.summary ?? ""),
        description: options.description as string | undefined,
        issueType: options.type as string | undefined,
      }),
    onSuccess: printJiraIssueResult,
  });
}

export const jiraIssuesCapability = createJiraIssuesCapability(jiraAdapter);
export const jiraIssueCapability = createJiraIssueCapability(jiraAdapter);
export const jiraCreateIssueCapability = createJiraCreateIssueCapability(jiraAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}

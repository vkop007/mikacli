import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { jiraAdapter, type JiraAdapter } from "../adapter.js";
import { printJiraProjectResult, printJiraProjectsResult } from "../output.js";

export function createJiraProjectsCapability(adapter: JiraAdapter) {
  return createAdapterActionCapability({
    id: "projects",
    command: "projects [query]",
    description: `List ${adapter.displayName} projects for the authenticated account`,
    spinnerText: `Loading ${adapter.displayName} projects...`,
    successMessage: `${adapter.displayName} projects loaded.`,
    options: [{ flags: "--limit <number>", description: "Maximum projects to load (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.projects({
        query: args[0] ? String(args[0]) : undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printJiraProjectsResult,
  });
}

export function createJiraProjectCapability(adapter: JiraAdapter) {
  return createAdapterActionCapability({
    id: "project",
    command: "project <target>",
    description: `Load a single ${adapter.displayName} project by key, ID, or URL`,
    spinnerText: `Loading ${adapter.displayName} project...`,
    successMessage: `${adapter.displayName} project loaded.`,
    action: ({ args }) => adapter.project(String(args[0] ?? "")),
    onSuccess: printJiraProjectResult,
  });
}

export const jiraProjectsCapability = createJiraProjectsCapability(jiraAdapter);
export const jiraProjectCapability = createJiraProjectCapability(jiraAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}

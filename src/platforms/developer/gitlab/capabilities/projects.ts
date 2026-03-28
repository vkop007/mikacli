import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { gitlabAdapter, type GitLabAdapter } from "../adapter.js";
import { printGitLabProjectResult, printGitLabProjectsResult } from "../output.js";

export function createGitLabProjectsCapability(adapter: GitLabAdapter) {
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
    onSuccess: printGitLabProjectsResult,
  });
}

export function createGitLabProjectCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "project",
    command: "project <target>",
    description: `Load a single ${adapter.displayName} project by ID, path, or URL`,
    spinnerText: `Loading ${adapter.displayName} project...`,
    successMessage: `${adapter.displayName} project loaded.`,
    action: ({ args }) =>
      adapter.project(String(args[0] ?? "")),
    onSuccess: printGitLabProjectResult,
  });
}

export function createGitLabSearchProjectsCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "search-projects",
    command: "search-projects <query>",
    aliases: ["search"],
    description: `Search ${adapter.displayName} projects`,
    spinnerText: `Searching ${adapter.displayName} projects...`,
    successMessage: `${adapter.displayName} project search completed.`,
    options: [{ flags: "--limit <number>", description: "Maximum projects to return (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.searchProjects({
        query: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printGitLabProjectsResult,
  });
}

export const gitlabProjectsCapability = createGitLabProjectsCapability(gitlabAdapter);
export const gitlabProjectCapability = createGitLabProjectCapability(gitlabAdapter);
export const gitlabSearchProjectsCapability = createGitLabSearchProjectsCapability(gitlabAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}


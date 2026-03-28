import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export function createGitHubUserCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "user",
    command: "user <login>",
    description: `Load a public ${adapter.displayName} user profile`,
    spinnerText: `Loading ${adapter.displayName} user...`,
    successMessage: `${adapter.displayName} user loaded.`,
    action: ({ args }) => adapter.user(String(args[0] ?? "")),
    onSuccess: printGitHubIdentityResult,
  });
}

export const githubUserCapability = createGitHubUserCapability(githubAdapter);

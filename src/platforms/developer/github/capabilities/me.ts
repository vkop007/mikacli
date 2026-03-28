import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export function createGitHubMeCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    aliases: ["whoami"],
    description: `Load the authenticated ${adapter.displayName} account`,
    spinnerText: `Loading ${adapter.displayName} account...`,
    successMessage: `${adapter.displayName} account loaded.`,
    action: () => adapter.me(),
    onSuccess: printGitHubIdentityResult,
  });
}

export const githubMeCapability = createGitHubMeCapability(githubAdapter);

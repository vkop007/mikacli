import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export function createGitHubLoginCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Save a ${adapter.displayName} token for future API calls`,
    spinnerText: `Validating ${adapter.displayName} token...`,
    successMessage: `${adapter.displayName} token saved.`,
    options: [{ flags: "--token <token>", description: `${adapter.displayName} token`, required: true }],
    action: ({ options }) =>
      adapter.loginWithToken({
        token: String(options.token ?? ""),
      }),
    onSuccess: printGitHubIdentityResult,
  });
}

export const githubLoginCapability = createGitHubLoginCapability(githubAdapter);

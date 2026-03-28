import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { gitlabAdapter, type GitLabAdapter } from "../adapter.js";
import { printGitLabIdentityResult } from "../output.js";

export function createGitLabLoginCapability(adapter: GitLabAdapter) {
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
    onSuccess: printGitLabIdentityResult,
  });
}

export const gitlabLoginCapability = createGitLabLoginCapability(gitlabAdapter);


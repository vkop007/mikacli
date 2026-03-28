import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { gitlabAdapter, type GitLabAdapter } from "../adapter.js";
import { printGitLabIdentityResult } from "../output.js";

export function createGitLabMeCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    aliases: ["whoami"],
    description: `Load the authenticated ${adapter.displayName} account`,
    spinnerText: `Loading ${adapter.displayName} identity...`,
    successMessage: `${adapter.displayName} identity loaded.`,
    action: () => adapter.me(),
    onSuccess: printGitLabIdentityResult,
  });
}

export const gitlabMeCapability = createGitLabMeCapability(gitlabAdapter);


import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export const githubMeCapability = createAdapterActionCapability({
  id: "me",
  command: "me",
  aliases: ["whoami"],
  description: "Load the authenticated GitHub account",
  spinnerText: "Loading GitHub account...",
  successMessage: "GitHub account loaded.",
  action: () => githubAdapter.me(),
  onSuccess: printGitHubIdentityResult,
});

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export const githubUserCapability = createAdapterActionCapability({
  id: "user",
  command: "user <login>",
  description: "Load a public GitHub user profile",
  spinnerText: "Loading GitHub user...",
  successMessage: "GitHub user loaded.",
  action: ({ args }) => githubAdapter.user(String(args[0] ?? "")),
  onSuccess: printGitHubIdentityResult,
});

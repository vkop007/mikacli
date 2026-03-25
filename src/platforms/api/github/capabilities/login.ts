import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export const githubLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save a GitHub personal access token for future API calls",
  spinnerText: "Validating GitHub token...",
  successMessage: "GitHub token saved.",
  options: [{ flags: "--token <token>", description: "GitHub personal access token", required: true }],
  action: ({ options }) =>
    githubAdapter.loginWithToken({
      token: String(options.token ?? ""),
    }),
  onSuccess: printGitHubIdentityResult,
});

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export function createGitHubLoginCapability(adapter: GitHubAdapter) {
  const cookieMode = adapter.authMode === "cookies";
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: cookieMode
      ? `Save the ${adapter.displayName} web session for future CLI use. With no auth flags, MikaCLI opens browser login by default`
      : `Save a ${adapter.displayName} token for future API calls`,
    spinnerText: cookieMode ? `Saving ${adapter.displayName} session...` : `Validating ${adapter.displayName} token...`,
    successMessage: cookieMode ? `${adapter.displayName} session saved.` : `${adapter.displayName} token saved.`,
    options: cookieMode
      ? createCookieLoginOptions()
      : [
          { flags: "--token <token>", description: `${adapter.displayName} token`, required: true },
          { flags: "--account <name>", description: "Optional saved alias instead of the detected GitHub account" },
        ],
    action: ({ options }) =>
      adapter.login(
        cookieMode
          ? resolveCookieLoginInput(options)
          : {
              account: options.account as string | undefined,
              token: String(options.token ?? ""),
            },
      ),
    onSuccess: printGitHubIdentityResult,
  });
}

export const githubLoginCapability = createGitHubLoginCapability(githubAdapter);

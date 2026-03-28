import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { printGitHubIdentityResult } from "../output.js";

export function createGitHubLoginCapability(adapter: GitHubAdapter) {
  const cookieMode = adapter.authMode === "cookies";
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: cookieMode
      ? `Import cookies and save the ${adapter.displayName} web session for future CLI use`
      : `Save a ${adapter.displayName} token for future API calls`,
    spinnerText: cookieMode ? `Importing ${adapter.displayName} session...` : `Validating ${adapter.displayName} token...`,
    successMessage: cookieMode ? `${adapter.displayName} session saved.` : `${adapter.displayName} token saved.`,
    options: cookieMode
      ? [
          { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
          { flags: "--account <name>", description: "Optional saved alias instead of the detected GitHub account" },
          { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
          { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
        ]
      : [
          { flags: "--token <token>", description: `${adapter.displayName} token`, required: true },
          { flags: "--account <name>", description: "Optional saved alias instead of the detected GitHub account" },
        ],
    action: ({ options }) =>
      adapter.login(
        cookieMode
          ? {
              account: options.account as string | undefined,
              cookieFile: options.cookies as string | undefined,
              cookieString: options.cookieString as string | undefined,
              cookieJson: options.cookieJson as string | undefined,
            }
          : {
              account: options.account as string | undefined,
              token: String(options.token ?? ""),
            },
      ),
    onSuccess: printGitHubIdentityResult,
  });
}

export const githubLoginCapability = createGitHubLoginCapability(githubAdapter);

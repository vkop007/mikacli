import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { jiraAdapter, type JiraAdapter } from "../adapter.js";
import { printJiraIdentityResult } from "../output.js";

export function createJiraLoginCapability(adapter: JiraAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Save the ${adapter.displayName} web session for future CLI use. With no auth flags, MikaCLI opens browser login by default`,
    spinnerText: `Saving ${adapter.displayName} session...`,
    successMessage: `${adapter.displayName} session saved.`,
    options: createCookieLoginOptions([{ flags: "--site <url>", description: "Jira site URL, like https://your-workspace.atlassian.net" }]),
    action: ({ options }) =>
      adapter.login({
        ...resolveCookieLoginInput(options),
        site: options.site as string | undefined,
      }),
    onSuccess: printJiraIdentityResult,
  });
}

export const jiraLoginCapability = createJiraLoginCapability(jiraAdapter);

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { confluenceAdapter, type ConfluenceAdapter } from "../adapter.js";
import { printConfluenceIdentityResult } from "../output.js";

export function createConfluenceLoginCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Save the ${adapter.displayName} web session for future CLI use. With no auth flags, MikaCLI opens browser login by default`,
    spinnerText: `Saving ${adapter.displayName} session...`,
    successMessage: `${adapter.displayName} session saved.`,
    options: createCookieLoginOptions([{ flags: "--site <url>", description: "Confluence site URL, like https://your-workspace.atlassian.net/wiki" }]),
    action: ({ options }) =>
      adapter.login({
        ...resolveCookieLoginInput(options),
        site: options.site as string | undefined,
      }),
    onSuccess: printConfluenceIdentityResult,
  });
}

export const confluenceLoginCapability = createConfluenceLoginCapability(confluenceAdapter);

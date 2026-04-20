import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { trelloAdapter, type TrelloAdapter } from "../adapter.js";
import { printTrelloIdentityResult } from "../output.js";

export function createTrelloLoginCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Save the ${adapter.displayName} web session for future CLI use. With no auth flags, MikaCLI opens browser login by default`,
    spinnerText: `Saving ${adapter.displayName} session...`,
    successMessage: `${adapter.displayName} session saved.`,
    options: createCookieLoginOptions(),
    action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
    onSuccess: printTrelloIdentityResult,
  });
}

export const trelloLoginCapability = createTrelloLoginCapability(trelloAdapter);

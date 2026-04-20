import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionIdentityResult } from "../output.js";

export function createNotionLoginCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Save the Notion web session for future CLI use. With no auth flags, MikaCLI opens browser login by default",
    spinnerText: "Saving Notion session...",
    successMessage: "Notion session saved.",
    options: createCookieLoginOptions(),
    action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
    onSuccess: printNotionIdentityResult,
  });
}

export const notionLoginCapability = createNotionLoginCapability(notionAdapter);

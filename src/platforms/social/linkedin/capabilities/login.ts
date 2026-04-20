import { createAdapterActionCapability, createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { linkedinAdapter } from "../adapter.js";

export const linkedinLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the LinkedIn session for future headless use. With no auth flags, MikaCLI opens browser login by default",
  spinnerText: "Saving LinkedIn session...",
  successMessage: "LinkedIn session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => linkedinAdapter.login(resolveCookieLoginInput(options)),
});

export const linkedinStatusCapability = createAdapterStatusCapability({
  adapter: linkedinAdapter,
  subject: "session",
});

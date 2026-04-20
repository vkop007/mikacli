import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { facebookAdapter } from "../adapter.js";

export const facebookLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the Facebook session for future headless use. With no auth flags, MikaCLI opens browser login by default",
  spinnerText: "Saving Facebook session...",
  successMessage: "Facebook session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => facebookAdapter.login(resolveCookieLoginInput(options)),
});

export const facebookStatusCapability = createAdapterActionCapability({
  id: "status",
  command: "status",
  description: "Show the saved Facebook session status",
  spinnerText: "Checking Facebook session...",
  successMessage: "Facebook session checked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Facebook session" }],
  action: ({ options }) => facebookAdapter.statusAction(options.account as string | undefined),
});

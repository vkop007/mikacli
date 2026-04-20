import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { instagramAdapter } from "../adapter.js";

export const instagramLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the Instagram session for future headless use. With no auth flags, MikaCLI opens browser login by default",
  spinnerText: "Saving Instagram session...",
  successMessage: "Instagram session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => instagramAdapter.login(resolveCookieLoginInput(options)),
});

export const instagramStatusCapability = createAdapterActionCapability({
  id: "status",
  command: "status",
  description: "Show the saved Instagram session status",
  spinnerText: "Checking Instagram session...",
  successMessage: "Instagram session checked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ options }) => instagramAdapter.statusAction(options.account as string | undefined),
});

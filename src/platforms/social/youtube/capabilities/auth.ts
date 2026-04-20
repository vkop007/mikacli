import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { youtubeAdapter } from "../adapter.js";

export const youtubeLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the YouTube session for future headless use. With no auth flags, MikaCLI opens browser login by default",
  spinnerText: "Saving YouTube session...",
  successMessage: "YouTube session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => youtubeAdapter.login(resolveCookieLoginInput(options)),
});

export const youtubeStatusCapability = createAdapterActionCapability({
  id: "status",
  command: "status",
  description: "Show the saved YouTube session status",
  spinnerText: "Checking YouTube session...",
  successMessage: "YouTube session checked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube session" }],
  action: ({ options }) => youtubeAdapter.statusAction(options.account as string | undefined),
});

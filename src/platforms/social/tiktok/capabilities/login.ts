import { createAdapterActionCapability, createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { tiktokAdapter } from "../adapter.js";

export const tiktokLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the TikTok session for future headless use. With no auth flags, MikaCLI opens browser login by default",
  spinnerText: "Saving TikTok session...",
  successMessage: "TikTok session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => tiktokAdapter.login(resolveCookieLoginInput(options)),
});

export const tiktokStatusCapability = createAdapterStatusCapability({
  adapter: tiktokAdapter,
  subject: "session",
});

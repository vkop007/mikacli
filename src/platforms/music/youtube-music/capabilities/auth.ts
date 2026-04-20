import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { youtubeMusicAdapter } from "../adapter.js";

export const youtubeMusicLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the YouTube Music session for future headless use. With no auth flags, MikaCLI opens browser login by default",
  spinnerText: "Saving YouTube Music session...",
  successMessage: "YouTube Music session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => youtubeMusicAdapter.login(resolveCookieLoginInput(options)),
});

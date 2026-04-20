import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import type { SpotifyAdapter } from "../service.js";

export function createSpotifyLoginCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Save the Spotify session for future headless use. With no auth flags, MikaCLI opens browser login by default",
    spinnerText: "Saving Spotify session...",
    successMessage: "Spotify session saved.",
    options: createCookieLoginOptions(),
    action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
  });
}

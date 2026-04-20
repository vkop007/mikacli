import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { twitchAdapter } from "../adapter.js";
import { printTwitchProfileResult, printTwitchStatusResult } from "../output.js";

export const twitchLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the Twitch session for future CLI use. With no auth flags, MikaCLI opens browser login by default",
  spinnerText: "Saving Twitch session...",
  successMessage: "Twitch session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => twitchAdapter.login(resolveCookieLoginInput(options)),
});

export const twitchStatusCapability = createAdapterActionCapability({
  id: "status",
  command: "status",
  description: "Show the saved Twitch session status",
  spinnerText: "Checking Twitch session...",
  successMessage: "Twitch session checked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Twitch session" }],
  action: ({ options }) => twitchAdapter.statusAction(options.account as string | undefined),
  onSuccess: printTwitchStatusResult,
});

export const twitchMeCapability = createAdapterActionCapability({
  id: "me",
  command: "me",
  aliases: ["account"],
  description: "Load the current Twitch account profile from the saved session",
  spinnerText: "Loading Twitch profile...",
  successMessage: "Twitch profile loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Twitch session" }],
  action: ({ options }) => twitchAdapter.me(options.account as string | undefined),
  onSuccess: printTwitchProfileResult,
});

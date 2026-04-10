import { createAdapterActionCapability, createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import { discordBotAdapter } from "../adapter.js";
import { printDiscordIdentityResult } from "../output.js";

export const discordBotLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save a Discord bot token for future REST calls",
  spinnerText: "Validating Discord bot token...",
  successMessage: "Discord bot token saved.",
  options: [
    { flags: "--token <token>", description: "Discord bot token to save", required: true },
    { flags: "--name <botName>", description: "Optional bot name to save instead of the detected Discord bot username" },
  ],
  action: ({ options }) =>
    discordBotAdapter.loginWithToken({
      token: String(options.token ?? ""),
      account: options.name as string | undefined,
    }),
  onSuccess: printDiscordIdentityResult,
});

export const discordBotStatusCapability = createAdapterStatusCapability({
  adapter: discordBotAdapter,
  accountOption: {
    key: "bot",
    flags: "--bot <name>",
    description: "Optional saved Discord bot name to inspect",
  },
});

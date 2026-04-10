import { createAdapterActionCapability, createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import { telegrambotAdapter } from "../adapter.js";

export const telegrambotLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save a Telegram bot token for future API use",
  spinnerText: "Saving Telegram bot token...",
  successMessage: "Telegram bot token saved.",
  options: [
    { flags: "--token <value>", description: "Telegram bot token from BotFather", required: true },
    { flags: "--name <botName>", description: "Optional bot name to save instead of the detected Telegram bot username" },
  ],
  action: ({ options }) =>
    telegrambotAdapter.login({
      token: options.token as string | undefined,
      account: options.name as string | undefined,
    }),
});

export const telegrambotStatusCapability = createAdapterStatusCapability({
  adapter: telegrambotAdapter,
  accountOption: {
    key: "bot",
    flags: "--bot <name>",
    description: "Optional saved Telegram bot name to inspect",
  },
});

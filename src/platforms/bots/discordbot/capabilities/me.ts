import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { discordBotAdapter } from "../adapter.js";
import { printDiscordIdentityResult } from "../output.js";

export const discordBotMeCapability = createAdapterActionCapability({
  id: "me",
  command: "me",
  description: "Inspect the current Discord bot identity",
  spinnerText: "Loading Discord bot identity...",
  successMessage: "Discord bot identity loaded.",
  options: [{ flags: "--bot <name>", description: "Optional saved Discord bot name to use" }],
  action: ({ options }) => discordBotAdapter.me(options.bot as string | undefined),
  onSuccess: printDiscordIdentityResult,
});

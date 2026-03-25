import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { discordBotAdapter } from "../adapter.js";
import { printDiscordGuildsResult } from "../output.js";

export const discordBotGuildsCapability = createAdapterActionCapability({
  id: "guilds",
  command: "guilds",
  description: "List Discord guilds visible to the bot token",
  spinnerText: "Loading Discord guilds...",
  successMessage: "Discord guilds loaded.",
  options: [{ flags: "--bot <name>", description: "Optional saved Discord bot name to use" }],
  action: ({ options }) => discordBotAdapter.guilds(options.bot as string | undefined),
  onSuccess: printDiscordGuildsResult,
});

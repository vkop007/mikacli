import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { discordBotAdapter } from "../adapter.js";
import { printDiscordChannelsResult } from "../output.js";

export const discordBotChannelsCapability = createAdapterActionCapability({
  id: "channels",
  command: "channels <guildId>",
  description: "List channels in a Discord guild",
  spinnerText: "Loading Discord channels...",
  successMessage: "Discord channels loaded.",
  options: [{ flags: "--bot <name>", description: "Optional saved Discord bot name to use" }],
  action: ({ args, options }) =>
    discordBotAdapter.channels({
      account: options.bot as string | undefined,
      guildId: String(args[0] ?? ""),
    }),
  onSuccess: printDiscordChannelsResult,
});

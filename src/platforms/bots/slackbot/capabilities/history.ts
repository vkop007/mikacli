import { slackbotClient } from "../client.js";
import { createSlackbotCapability } from "../capability-helpers.js";
import { printSlackbotHistory } from "../output.js";

export const slackbotHistoryCapability = createSlackbotCapability({
  id: "history",
  command: "history",
  description: "Load recent Slack messages from a channel",
  spinnerText: "Loading Slack messages...",
  successMessage: "Slack messages loaded.",
  options: [
    { flags: "--limit <count>", description: "Maximum number of messages to load", parser: (value) => Number.parseInt(value, 10) },
    { flags: "--cursor <cursor>", description: "Pagination cursor from a previous history call" },
    { flags: "--latest <ts>", description: "Only include messages at or before this Slack timestamp" },
    { flags: "--oldest <ts>", description: "Only include messages at or after this Slack timestamp" },
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  configure(subcommand) {
    subcommand.argument("<channel>");
  },
  action: async ({ args, options }) =>
    await slackbotClient.history({
      channel: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      cursor: options.cursor as string | undefined,
      latest: options.latest as string | undefined,
      oldest: options.oldest as string | undefined,
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotHistory(result, json);
  },
});

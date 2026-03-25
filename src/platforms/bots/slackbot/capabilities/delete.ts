import { slackbotClient } from "../client.js";
import { createSlackbotCapability, printSlackbotActionResult } from "../capability-helpers.js";

export const slackbotDeleteCapability = createSlackbotCapability({
  id: "delete",
  command: "delete",
  description: "Delete a Slack message",
  spinnerText: "Deleting Slack message...",
  successMessage: "Slack message deleted.",
  options: [
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  configure(subcommand) {
    subcommand.argument("<channel>");
    subcommand.argument("<ts>");
  },
  action: async ({ args, options }) =>
    await slackbotClient.deleteMessage({
      channel: String(args[0] ?? ""),
      ts: String(args[1] ?? ""),
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotActionResult(result, json);
  },
});

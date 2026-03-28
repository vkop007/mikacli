import { slackbotClient } from "../client.js";
import { createSlackbotCapability, printSlackbotActionResult } from "../capability-helpers.js";

function joinTextArgs(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((part) => String(part)).join(" ").trim();
  }

  return String(value ?? "").trim();
}

export const slackbotSendCapability = createSlackbotCapability({
  id: "send",
  command: "send",
  description: "Send a message to a Slack channel",
  spinnerText: "Sending Slack message...",
  successMessage: "Slack message sent.",
  options: [
    { flags: "--thread-ts <ts>", description: "Reply in a Slack thread using the parent message ts" },
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  configure(subcommand) {
    subcommand.argument("<channel>");
    subcommand.argument("<text...>");
  },
  action: async ({ args, options }) =>
    await slackbotClient.sendMessage({
      channel: String(args[0] ?? ""),
      text: joinTextArgs(args[1]),
      threadTs: options.threadTs as string | undefined,
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotActionResult(result, json);
  },
});

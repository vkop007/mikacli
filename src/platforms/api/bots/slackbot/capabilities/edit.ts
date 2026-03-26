import { slackbotClient } from "../client.js";
import { createSlackbotCapability, printSlackbotActionResult } from "../capability-helpers.js";

function joinTextArgs(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((part) => String(part)).join(" ").trim();
  }

  return String(value ?? "").trim();
}

export const slackbotEditCapability = createSlackbotCapability({
  id: "edit",
  command: "edit",
  description: "Edit a Slack message",
  spinnerText: "Editing Slack message...",
  successMessage: "Slack message edited.",
  options: [
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  configure(subcommand) {
    subcommand.argument("<channel>");
    subcommand.argument("<ts>");
    subcommand.argument("<text...>");
  },
  action: async ({ args, options }) =>
    await slackbotClient.editMessage({
      channel: String(args[0] ?? ""),
      ts: String(args[1] ?? ""),
      text: joinTextArgs(args[2]),
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotActionResult(result, json);
  },
});

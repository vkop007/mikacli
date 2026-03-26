import { slackbotClient } from "../client.js";
import { createSlackbotCapability, printSlackbotActionResult } from "../capability-helpers.js";

export const slackbotSendFileCapability = createSlackbotCapability({
  id: "send-file",
  command: "send-file",
  aliases: ["file"],
  description: "Upload a file to a Slack channel",
  spinnerText: "Uploading Slack file...",
  successMessage: "Slack file uploaded.",
  options: [
    { flags: "--title <title>", description: "Optional file title shown in Slack" },
    { flags: "--comment <text>", description: "Optional message to send with the file" },
    { flags: "--thread-ts <ts>", description: "Reply in a Slack thread using the parent message ts" },
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  configure(subcommand) {
    subcommand.argument("<channel>");
    subcommand.argument("<filePath>");
  },
  action: async ({ args, options }) =>
    await slackbotClient.sendFile({
      channel: String(args[0] ?? ""),
      filePath: String(args[1] ?? ""),
      title: options.title as string | undefined,
      comment: options.comment as string | undefined,
      threadTs: options.threadTs as string | undefined,
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotActionResult(result, json);
  },
});

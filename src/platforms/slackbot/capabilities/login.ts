import { slackbotClient } from "../client.js";
import { createSlackbotCapability, printSlackbotActionResult } from "../capability-helpers.js";

export const slackbotLoginCapability = createSlackbotCapability({
  id: "login",
  command: "login",
  description: "Save a Slack bot token for future commands",
  spinnerText: "Saving Slack bot token...",
  successMessage: "Slack bot token saved.",
  options: [
    { flags: "--token <token>", description: "Slack bot token to save", required: true },
    { flags: "--name <botName>", description: "Optional bot name to save instead of the detected Slack identity" },
  ],
  action: async ({ options }) =>
    await slackbotClient.login({
      token: options.token as string,
      account: options.name as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotActionResult(result, json);
  },
});

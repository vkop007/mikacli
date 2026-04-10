import { slackbotClient } from "../client.js";
import { createSlackbotCapability, printSlackbotActionResult } from "../capability-helpers.js";

export const slackbotStatusCapability = createSlackbotCapability({
  id: "status",
  command: "status",
  description: "Show the saved Slack bot connection status",
  spinnerText: "Checking Slack bot connection...",
  successMessage: "Slack bot connection checked.",
  options: [
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  action: async ({ options }) =>
    await slackbotClient.status({
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotActionResult(result, json);
  },
});

export const slackbotAuthTestCapability = createSlackbotCapability({
  id: "auth-test",
  command: "me",
  aliases: ["auth-test"],
  description: "Show the saved Slack bot identity and verify the token",
  spinnerText: "Checking Slack bot token...",
  successMessage: "Slack bot token verified.",
  options: [
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  action: async ({ options }) =>
    await slackbotClient.authTest({
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotActionResult(result, json);
  },
});

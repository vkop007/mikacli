import { slackbotClient } from "../client.js";
import { createSlackbotCapability, printSlackbotActionResult } from "../capability-helpers.js";

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

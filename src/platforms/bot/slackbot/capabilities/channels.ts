import { slackbotClient } from "../client.js";
import { createSlackbotCapability } from "../capability-helpers.js";
import { printSlackbotChannels } from "../output.js";

export const slackbotChannelsCapability = createSlackbotCapability({
  id: "channels",
  command: "channels",
  description: "List visible Slack channels",
  spinnerText: "Loading Slack channels...",
  successMessage: "Slack channels loaded.",
  options: [
    { flags: "--bot <name>", description: "Optional saved Slack bot name to use" },
  ],
  action: async ({ options }) =>
    await slackbotClient.listChannels({
      account: options.bot as string | undefined,
    }),
  onSuccess: (result, json) => {
    printSlackbotChannels(result, json);
  },
});

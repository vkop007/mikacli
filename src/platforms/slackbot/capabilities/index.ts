import { slackbotChannelsCapability } from "./channels.js";
import { slackbotDeleteCapability } from "./delete.js";
import { slackbotEditCapability } from "./edit.js";
import { slackbotSendFileCapability } from "./file.js";
import { slackbotHistoryCapability } from "./history.js";
import { slackbotAuthTestCapability } from "./me.js";
import { slackbotLoginCapability } from "./login.js";
import { slackbotSendCapability } from "./send.js";

import type { SlackbotCapability } from "../capability-helpers.js";

export const slackbotCapabilities: readonly SlackbotCapability[] = [
  slackbotLoginCapability,
  slackbotAuthTestCapability,
  slackbotChannelsCapability,
  slackbotHistoryCapability,
  slackbotSendCapability,
  slackbotSendFileCapability,
  slackbotEditCapability,
  slackbotDeleteCapability,
];

import { discordBotChannelsCapability } from "./channels.js";
import {
  discordBotDeleteCapability,
  discordBotEditCapability,
  discordBotHistoryCapability,
  discordBotSendCapability,
  discordBotSendFileCapability,
} from "./messages.js";
import { discordBotGuildsCapability } from "./guilds.js";
import { discordBotLoginCapability } from "./login.js";
import { discordBotMeCapability } from "./me.js";

import type { PlatformCapability } from "../../../../../core/runtime/platform-definition.js";

export const discordBotCapabilities: readonly PlatformCapability[] = [
  discordBotLoginCapability,
  discordBotMeCapability,
  discordBotGuildsCapability,
  discordBotChannelsCapability,
  discordBotHistoryCapability,
  discordBotSendCapability,
  discordBotSendFileCapability,
  discordBotEditCapability,
  discordBotDeleteCapability,
];

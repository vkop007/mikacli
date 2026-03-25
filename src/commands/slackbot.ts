import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { slackbotPlatformDefinition } from "../platforms/bots/slackbot/manifest.js";

export function createSlackbotCommand() {
  return buildPlatformCommand(slackbotPlatformDefinition);
}

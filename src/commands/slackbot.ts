import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { slackbotPlatformDefinition } from "../platforms/api/bots/slackbot/manifest.js";

export function createSlackbotCommand() {
  return buildPlatformCommand(slackbotPlatformDefinition);
}

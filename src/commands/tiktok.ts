import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { tiktokPlatformDefinition } from "../platforms/tiktok/manifest.js";

export function createTikTokCommand() {
  return buildPlatformCommand(tiktokPlatformDefinition);
}

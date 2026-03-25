import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { facebookPlatformDefinition } from "../platforms/social/facebook/manifest.js";

export function createFacebookCommand() {
  return buildPlatformCommand(facebookPlatformDefinition);
}

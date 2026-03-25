import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { facebookPlatformDefinition } from "../platforms/facebook/manifest.js";

export function createFacebookCommand() {
  return buildPlatformCommand(facebookPlatformDefinition);
}

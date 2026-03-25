import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { xPlatformDefinition } from "../platforms/social/x/manifest.js";

export function createXCommand() {
  return buildPlatformCommand(xPlatformDefinition);
}

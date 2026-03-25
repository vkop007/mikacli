import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { instagramPlatformDefinition } from "../platforms/social/instagram/manifest.js";

export function createInstagramCommand() {
  return buildPlatformCommand(instagramPlatformDefinition);
}

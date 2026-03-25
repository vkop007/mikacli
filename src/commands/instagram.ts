import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { instagramPlatformDefinition } from "../platforms/instagram/manifest.js";

export function createInstagramCommand() {
  return buildPlatformCommand(instagramPlatformDefinition);
}

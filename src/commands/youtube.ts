import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { youtubePlatformDefinition } from "../platforms/social/youtube/manifest.js";

export function createYouTubeCommand() {
  return buildPlatformCommand(youtubePlatformDefinition);
}

import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { youtubePlatformDefinition } from "../platforms/youtube/manifest.js";

export function createYouTubeCommand() {
  return buildPlatformCommand(youtubePlatformDefinition);
}

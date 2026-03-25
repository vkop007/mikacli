import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { linkedinPlatformDefinition } from "../platforms/linkedin/manifest.js";

export function createLinkedInCommand() {
  return buildPlatformCommand(linkedinPlatformDefinition);
}

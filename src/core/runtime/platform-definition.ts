import type { Command } from "commander";

import type { AuthStrategyKind } from "../auth/auth-types.js";
import type { PlatformName } from "../../platforms/config.js";
import type { PlatformAdapter } from "../../types.js";

export interface PlatformDefinition {
  id: PlatformName;
  displayName: string;
  description: string;
  aliases?: readonly string[];
  authStrategies: readonly AuthStrategyKind[];
  examples?: readonly string[];
  capabilities?: readonly PlatformCapability[];
  buildCommand?: () => Command;
  adapter?: PlatformAdapter;
}

export interface PlatformCapability {
  id: string;
  register(command: Command, definition: PlatformDefinition): void;
}

import type { Command } from "commander";

import type { AuthStrategyKind } from "../auth/auth-types.js";
import type { PlatformName } from "../../platforms/config.js";

export type PlatformCategory = "social" | "bots" | "forum" | "api";

export interface PlatformDefinition {
  id: PlatformName;
  category: PlatformCategory;
  displayName: string;
  description: string;
  aliases?: readonly string[];
  authStrategies: readonly AuthStrategyKind[];
  examples?: readonly string[];
  capabilities?: readonly PlatformCapability[];
  buildCommand?: () => Command;
  adapter?: unknown;
}

export interface PlatformCapability {
  id: string;
  register(command: Command, definition: PlatformDefinition): void;
}

import type { Command } from "commander";

import type { AuthStrategyKind } from "../auth/auth-types.js";
import type { PlatformName } from "../../platforms/config.js";

export type PlatformCategory =
  | "llm"
  | "editor"
  | "finance"
  | "maps"
  | "movie"
  | "music"
  | "social"
  | "shopping"
  | "bot"
  | "developer"
  | "forum"
  | "tools";

export interface PlatformCommandBuildOptions {
  examplePrefix?: string;
}

export interface PlatformDefinition {
  id: PlatformName;
  category: PlatformCategory;
  commandCategories?: readonly PlatformCategory[];
  displayName: string;
  description: string;
  aliases?: readonly string[];
  authStrategies: readonly AuthStrategyKind[];
  examples?: readonly string[];
  capabilities?: readonly PlatformCapability[];
  buildCommand?: (options?: PlatformCommandBuildOptions) => Command;
  adapter?: unknown;
}

export interface PlatformCapability {
  id: string;
  register(command: Command, definition: PlatformDefinition): void;
}

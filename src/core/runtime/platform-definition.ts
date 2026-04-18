import type { Command } from "commander";

import type { AuthStrategyKind } from "../auth/auth-types.js";
import type { PlatformName } from "../../platforms/config.js";

export type PlatformCategory =
  | "llm"
  | "editor"
  | "finance"
  | "data"
  | "google"
  | "maps"
  | "movie"
  | "news"
  | "music"
  | "social"
  | "careers"
  | "shopping"
  | "devops"
  | "bot"
  | "developer"
  | "forum"
  | "tools";

export interface PlatformCommandBuildOptions {
  examplePrefix?: string;
}

export type PlatformCapabilitySupport = "supported" | "partial" | "unsupported" | "unknown";
export type PlatformStability = "stable" | "partial" | "experimental" | "unknown";

export interface PlatformCapabilityMetadata {
  auth: readonly AuthStrategyKind[];
  discovery: PlatformCapabilitySupport;
  mutation: PlatformCapabilitySupport;
  browserLogin: PlatformCapabilitySupport;
  browserFallback: PlatformCapabilitySupport;
  asyncJobs: PlatformCapabilitySupport;
  stability: PlatformStability;
  notes?: readonly string[];
}

export interface PlatformCapabilityMetadataInput extends Partial<Omit<PlatformCapabilityMetadata, "auth">> {}

export interface PlatformDefinition {
  id: PlatformName;
  category: PlatformCategory;
  commandCategories?: readonly PlatformCategory[];
  displayName: string;
  description: string;
  aliases?: readonly string[];
  authStrategies: readonly AuthStrategyKind[];
  capabilityMetadata?: PlatformCapabilityMetadataInput;
  examples?: readonly string[];
  capabilities?: readonly PlatformCapability[];
  buildCommand?: (options?: PlatformCommandBuildOptions) => Command;
  adapter?: unknown;
}

export interface PlatformCapability {
  id: string;
  register(command: Command, definition: PlatformDefinition): void;
}

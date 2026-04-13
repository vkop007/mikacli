import { getGeneratedPlatformDefinitions } from "./generated-registry.js";

import type { PlatformCategory, PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { PlatformName } from "./config.js";

let definitionsCache: readonly PlatformDefinition[] | null = null;
let definitionByIdCache: Map<PlatformName, PlatformDefinition> | null = null;

export function getPlatformDefinitions(): readonly PlatformDefinition[] {
  if (!definitionsCache) {
    definitionsCache = getGeneratedPlatformDefinitions();
  }

  return definitionsCache;
}

export function getPlatformDefinition(platform: PlatformName): PlatformDefinition | undefined {
  if (!definitionByIdCache) {
    definitionByIdCache = new Map(
      getPlatformDefinitions().map((definition) => [definition.id as PlatformName, definition] as const),
    );
  }

  return definitionByIdCache.get(platform);
}

export function getPlatformDefinitionsByCategory(category: PlatformCategory): readonly PlatformDefinition[] {
  return getPlatformDefinitions().filter((definition) => {
    const categories = definition.commandCategories ?? [definition.category];
    return categories.includes(category);
  });
}

export function getPlatformCategories(): readonly PlatformCategory[] {
  const order: readonly PlatformCategory[] = ["llm", "editor", "finance", "data", "google", "maps", "movie", "news", "music", "social", "shopping", "developer", "devops", "bot", "tools", "forum"];
  return order.filter((category) =>
    getPlatformDefinitions().some((definition) => {
      const categories = definition.commandCategories ?? [definition.category];
      return categories.includes(category);
    }),
  );
}

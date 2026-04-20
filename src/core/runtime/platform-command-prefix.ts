import type { PlatformDefinition } from "./platform-definition.js";

export function buildPlatformCommandPrefix(
  definition: Pick<PlatformDefinition, "id" | "category" | "commandCategories">,
  categoryOverride?: string,
): string {
  const category = categoryOverride ?? definition.commandCategories?.[0] ?? definition.category;
  return definition.id === category ? `mikacli ${category}` : `mikacli ${category} ${definition.id}`;
}

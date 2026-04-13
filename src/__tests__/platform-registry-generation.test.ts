import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, test } from "bun:test";

import { getPlatformDefinitions } from "../platforms/index.js";

import type { PlatformDefinition } from "../core/runtime/platform-definition.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const platformRoot = join(repoRoot, "src", "platforms");

describe("generated platform registry", () => {
  test("matches every manifest.ts on disk", async () => {
    const discovered: string[] = await discoverPlatformIds();
    const generated: string[] = getPlatformDefinitions().map((definition) => definition.id);

    generated.sort((left, right) => left.localeCompare(right));
    discovered.sort((left, right) => left.localeCompare(right));

    expect(generated).toEqual(discovered);
  });
});

async function discoverPlatformIds(): Promise<string[]> {
  const manifestPaths = await collectManifestPaths(platformRoot);
  const ids: string[] = [];

  for (const manifestPath of manifestPaths) {
    const module = await import(pathToFileURL(manifestPath).href);
    const platformExports = Object.values(module).filter(isPlatformDefinition);

    expect(platformExports.length, `Expected exactly one PlatformDefinition export in ${relative(repoRoot, manifestPath)}`).toBe(1);
    ids.push(platformExports[0]!.id);
  }

  expect(new Set(ids).size).toBe(ids.length);
  return ids;
}

async function collectManifestPaths(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "shared" || entry.name === "__tests__") {
        continue;
      }
      results.push(...(await collectManifestPaths(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name === "manifest.ts") {
      results.push(entryPath);
    }
  }

  return results.sort((left, right) =>
    left.split(sep).join("/").localeCompare(right.split(sep).join("/")),
  );
}

function isPlatformDefinition(value: unknown): value is PlatformDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PlatformDefinition>;
  return (
    typeof candidate.id === "string"
    && typeof candidate.category === "string"
    && typeof candidate.displayName === "string"
    && typeof candidate.description === "string"
    && Array.isArray(candidate.authStrategies)
  );
}

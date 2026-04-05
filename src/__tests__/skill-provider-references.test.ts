import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import { getPlatformDefinitions } from "../platforms/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const providerReferenceDir = join(repoRoot, "skills", "autocli", "references", "providers");

describe("AutoCLI skill provider references", () => {
  test("includes a generated provider reference file for every platform", () => {
    for (const definition of getPlatformDefinitions()) {
      expect(existsSync(join(providerReferenceDir, `${definition.id}.md`))).toBe(true);
    }
  });

  test("includes a generated provider index", () => {
    expect(existsSync(join(providerReferenceDir, "index.md"))).toBe(true);
  });
});

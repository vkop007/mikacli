import { describe, expect, test } from "bun:test";

import { getPlatformCategories } from "../platforms/index.js";

const ALLOWED_ROOT_COMMANDS = new Set<string>(["login", "status", "doctor", "sessions", "help", "-h", "--help", "-v", "--version", ...getPlatformCategories()]);

describe("README command examples", () => {
  test("use category-based routing for provider commands", async () => {
    const readme = await Bun.file(new URL("../../README.md", import.meta.url)).text();
    const violations: string[] = [];

    for (const block of extractCodeBlocks(readme)) {
      for (const rawLine of block.split("\n")) {
        const line = rawLine.trim();
        if (!line.startsWith("autocli ")) {
          continue;
        }

        const [, command] = line.split(/\s+/, 3);
        if (!command || ALLOWED_ROOT_COMMANDS.has(command)) {
          continue;
        }

        violations.push(line);
      }
    }

    expect(violations).toEqual([]);
  });
});

function extractCodeBlocks(markdown: string): string[] {
  const matches = markdown.matchAll(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g);
  return Array.from(matches, (match) => match[1] ?? "");
}

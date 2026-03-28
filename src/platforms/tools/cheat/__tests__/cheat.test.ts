import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";
import { cheatPlatformDefinition } from "../manifest.js";
import { buildCheatUrl, normalizeCheatLanguage, normalizeCheatShell, truncateCheatSnippet } from "../helpers.js";

describe("public cheat provider", () => {
  test("builds cht.sh urls", () => {
    expect(buildCheatUrl({ topic: "reverse list" })).toBe("https://cht.sh/reverse+list?T");
    expect(buildCheatUrl({ topic: "reverse list", shell: normalizeCheatShell("bash") })).toBe("https://cht.sh/bash/reverse+list?T");
    expect(buildCheatUrl({ topic: "list comprehension", lang: normalizeCheatLanguage("python") })).toBe(
      "https://cht.sh/python/list+comprehension?T",
    );
  });

  test("truncates large snippets", () => {
    const text = "a".repeat(5000);
    expect(truncateCheatSnippet(text)).toHaveLength(4000);
  });

  test("builds a command with the cheat capability", () => {
    const command = buildPlatformCommand(cheatPlatformDefinition);
    expect(command.name()).toBe("cheat");
    expect(command.commands).toHaveLength(0);
  });
});

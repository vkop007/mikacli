import { describe, expect, test } from "bun:test";

import { AutoCliError } from "../errors.js";
import { assertCategoryOnlyInvocation, createProgram } from "../program.js";

describe("root program routing", () => {
  test("registers only global commands and category commands at the top level", () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toEqual([
      "login",
      "logout",
      "search",
      "status",
      "doctor",
      "sessions",
      "llm",
      "editor",
      "finance",
      "data",
      "google",
      "maps",
      "movie",
      "news",
      "music",
      "social",
      "shopping",
      "developer",
      "devops",
      "bot",
      "tools",
    ]);
  });

  test("rejects legacy direct provider invocations with a category hint", () => {
    expect(() => assertCategoryOnlyInvocation(["chatgpt", "text", "Hello"])).toThrow(AutoCliError);

    try {
      assertCategoryOnlyInvocation(["chatgpt", "text", "Hello"]);
      throw new Error("Expected category-only assertion to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(AutoCliError);
      expect((error as AutoCliError).code).toBe("CATEGORY_COMMAND_REQUIRED");
      expect((error as AutoCliError).message).toContain('autocli llm chatgpt text Hello');
      expect((error as AutoCliError).details?.suggestedCommand).toBe("autocli llm chatgpt text Hello");
    }
  });

  test("rejects direct help on providers with the nested help path", () => {
    try {
      assertCategoryOnlyInvocation(["help", "spotify"]);
      throw new Error("Expected help invocation to be redirected.");
    } catch (error) {
      expect(error).toBeInstanceOf(AutoCliError);
      expect((error as AutoCliError).message).toContain("autocli music spotify --help");
    }
  });

  test("preserves trailing arguments when redirecting direct providers", () => {
    try {
      assertCategoryOnlyInvocation(["github", "me", "--json"]);
      throw new Error("Expected direct provider invocation to be redirected.");
    } catch (error) {
      expect(error).toBeInstanceOf(AutoCliError);
      expect((error as AutoCliError).details?.suggestedCommand).toBe("autocli developer github me --json");
    }
  });

  test("allows category-based invocations", () => {
    expect(() => assertCategoryOnlyInvocation(["login", "--browser"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["logout", "x", "default"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["search", "github"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["llm", "chatgpt", "text", "Hello"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["editor", "image", "info", "./photo.png"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["finance", "stocks", "AAPL"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["data", "json", "format", "./payload.json"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["google", "gmail", "me"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["maps", "openstreetmap", "search", "Mumbai"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["news", "top", "AI"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["developer", "github", "me"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["devops", "cloudflare", "zones"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["bot", "telegrambot", "me"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["tools", "translate", "hello"])).not.toThrow();
  });
});

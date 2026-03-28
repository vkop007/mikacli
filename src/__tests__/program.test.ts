import { describe, expect, test } from "bun:test";

import { AutoCliError } from "../errors.js";
import { assertCategoryOnlyInvocation, createProgram } from "../program.js";

describe("root program routing", () => {
  test("registers only global commands and category commands at the top level", () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toEqual([
      "status",
      "llm",
      "editor",
      "finance",
      "maps",
      "movie",
      "music",
      "social",
      "shopping",
      "developer",
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
      expect((error as AutoCliError).message).toContain('autocli llm chatgpt ...');
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

  test("allows category-based invocations", () => {
    expect(() => assertCategoryOnlyInvocation(["llm", "chatgpt", "text", "Hello"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["editor", "image", "info", "./photo.png"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["finance", "stocks", "AAPL"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["maps", "openstreetmap", "search", "Mumbai"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["developer", "github", "me"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["bot", "telegrambot", "me"])).not.toThrow();
    expect(() => assertCategoryOnlyInvocation(["tools", "translate", "hello"])).not.toThrow();
  });
});

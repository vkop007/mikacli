import { describe, expect, test } from "bun:test";

import { buildSearchIndex, searchCommandIndex } from "../commands/search.js";
import { createProgram } from "../program.js";

describe("search command", () => {
  test("registers the root search command", () => {
    const commandNames = createProgram().commands.map((command) => command.name());
    expect(commandNames).toContain("search");
  });

  test("indexes providers and nested commands", () => {
    const index = buildSearchIndex();
    expect(index.some((entry) => entry.command === "mikacli tools download")).toBe(true);
    expect(index.some((entry) => entry.command === "mikacli tools download video")).toBe(true);
    expect(index.some((entry) => entry.command === "mikacli login")).toBe(true);
    expect(index.some((entry) => entry.command === "mikacli jobs")).toBe(true);
  });

  test("finds provider matches by display name and category words", () => {
    const results = searchCommandIndex(buildSearchIndex(), "uptime robot", { limit: 5 });
    expect(results[0]?.command).toBe("mikacli devops uptimerobot");
  });

  test("finds command matches from examples and descriptions", () => {
    const results = searchCommandIndex(buildSearchIndex(), "youtube download", { limit: 5 });
    expect(results.some((entry) => entry.command === "mikacli tools download")).toBe(true);
  });

  test("supports category filtering", () => {
    const results = searchCommandIndex(buildSearchIndex(), "uptime", {
      category: "devops",
      limit: 10,
    });
    expect(results.every((entry) => entry.category === "devops")).toBe(true);
  });

  test("finds root commands by option text", () => {
    const results = searchCommandIndex(buildSearchIndex(), "browser login", { limit: 5 });
    expect(results[0]?.command).toBe("mikacli login");
  });
});

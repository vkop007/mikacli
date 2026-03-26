import { describe, expect, test } from "bun:test";

import { buildCategoryCommand } from "../core/runtime/build-category-command.js";
import { getPlatformCategories, getPlatformDefinitionsByCategory } from "../platforms/index.js";

describe("platform category routing", () => {
  test("includes the new music category", () => {
    expect(getPlatformCategories()).toContain("music");
    expect(getPlatformDefinitionsByCategory("music").map((definition) => definition.id)).toEqual([
      "spotify",
      "youtube-music",
    ]);
  });

  test("exposes bot providers under api too", () => {
    const apiIds = getPlatformDefinitionsByCategory("api").map((definition) => definition.id);
    expect(apiIds).toContain("telegrambot");
    expect(apiIds).toContain("discordbot");
    expect(apiIds).toContain("slackbot");
    expect(apiIds).toContain("githubbot");
  });

  test("does not expose bot providers in a separate bots category", () => {
    expect(getPlatformDefinitionsByCategory("bots")).toEqual([]);
  });

  test("keeps youtube under social and out of music", () => {
    expect(getPlatformDefinitionsByCategory("social").some((definition) => definition.id === "youtube")).toBe(true);
    expect(getPlatformDefinitionsByCategory("music").some((definition) => definition.id === "youtube")).toBe(false);
  });

  test("builds category commands with nested provider commands", () => {
    const command = buildCategoryCommand("music", getPlatformDefinitionsByCategory("music"));
    expect(command.name()).toBe("music");
    expect(command.commands.map((nested) => nested.name())).toEqual(["spotify", "youtube-music"]);
  });
});

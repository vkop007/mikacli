import { describe, expect, test } from "bun:test";

import { buildCategoryCommand } from "../core/runtime/build-category-command.js";
import { getPlatformCategories, getPlatformDefinitionsByCategory } from "../platforms/index.js";

describe("platform category routing", () => {
  test("includes the llm category and providers", () => {
    expect(getPlatformCategories()).toContain("llm");
    expect(getPlatformDefinitionsByCategory("llm").map((definition) => definition.id)).toEqual([
      "chatgpt",
      "claude",
      "deepseek",
      "gemini",
      "grok",
      "mistral",
      "perplexity",
      "qwen",
      "zai",
    ]);
  });

  test("includes the new music category", () => {
    expect(getPlatformCategories()).toContain("music");
    expect(getPlatformDefinitionsByCategory("music").map((definition) => definition.id)).toEqual([
      "spotify",
      "youtube-music",
    ]);
  });

  test("includes the editor category and providers", () => {
    expect(getPlatformCategories()).toContain("editor");
    expect(getPlatformDefinitionsByCategory("editor").map((definition) => definition.id)).toEqual([
      "archive",
      "audio",
      "document",
      "gif",
      "image",
      "pdf",
      "subtitle",
      "video",
    ]);
  });

  test("includes the maps category and providers", () => {
    expect(getPlatformCategories()).toContain("maps");
    expect(getPlatformDefinitionsByCategory("maps").map((definition) => definition.id)).toEqual([
      "geo",
      "openstreetmap",
      "osrm",
    ]);
  });

  test("includes the movie category and providers", () => {
    expect(getPlatformCategories()).toContain("movie");
    expect(getPlatformDefinitionsByCategory("movie").map((definition) => definition.id)).toEqual([
      "anilist",
      "imdb",
      "justwatch",
      "kitsu",
      "myanimelist",
      "tvmaze",
    ]);
  });

  test("includes the shopping category and providers", () => {
    expect(getPlatformCategories()).toContain("shopping");
    expect(getPlatformDefinitionsByCategory("shopping").map((definition) => definition.id)).toEqual(["amazon", "flipkart"]);
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

  test("includes the new no-key public utility providers", () => {
    const publicIds = getPlatformDefinitionsByCategory("public").map((definition) => definition.id);
    expect(publicIds).toContain("translate");
    expect(publicIds).toContain("currency");
    expect(publicIds).toContain("dns");
    expect(publicIds).toContain("whois");
    expect(publicIds).toContain("rss");
    expect(publicIds).toContain("screenshot");
    expect(publicIds).toContain("sitemap");
    expect(publicIds).toContain("robots");
    expect(publicIds).toContain("stocks");
    expect(publicIds).toContain("crypto");
    expect(publicIds).toContain("markdown-fetch");
    expect(publicIds).toContain("uptime");
  });
});

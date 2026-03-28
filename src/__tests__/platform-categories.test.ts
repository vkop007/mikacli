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
      "soundcloud",
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

  test("includes the finance category and providers", () => {
    expect(getPlatformCategories()).toContain("finance");
    expect(getPlatformDefinitionsByCategory("finance").map((definition) => definition.id)).toEqual([
      "crypto",
      "currency",
      "stocks",
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
    expect(getPlatformDefinitionsByCategory("shopping").map((definition) => definition.id)).toEqual([
      "amazon",
      "ebay",
      "etsy",
      "flipkart",
    ]);
  });

  test("includes the developer category and providers", () => {
    expect(getPlatformCategories()).toContain("developer");
    expect(getPlatformDefinitionsByCategory("developer").map((definition) => definition.id)).toEqual([
      "github",
      "gitlab",
      "linear",
      "notion",
    ]);
  });

  test("includes the bot category and providers", () => {
    expect(getPlatformCategories()).toContain("bot");
    expect(getPlatformDefinitionsByCategory("bot").map((definition) => definition.id)).toEqual([
      "discordbot",
      "githubbot",
      "slackbot",
      "telegrambot",
    ]);
  });

  test("keeps youtube under social and out of music", () => {
    expect(getPlatformDefinitionsByCategory("social").some((definition) => definition.id === "youtube")).toBe(true);
    expect(getPlatformDefinitionsByCategory("music").some((definition) => definition.id === "youtube")).toBe(false);
  });

  test("builds category commands with nested provider commands", () => {
    const command = buildCategoryCommand("music", getPlatformDefinitionsByCategory("music"));
    expect(command.name()).toBe("music");
    expect(command.commands.map((nested) => nested.name())).toEqual(["soundcloud", "spotify", "youtube-music"]);
  });

  test("includes the tools category and utility providers", () => {
    const toolIds = getPlatformDefinitionsByCategory("tools").map((definition) => definition.id);
    expect(toolIds).toContain("translate");
    expect(toolIds).toContain("dns");
    expect(toolIds).toContain("headers");
    expect(toolIds).toContain("whois");
    expect(toolIds).toContain("rss");
    expect(toolIds).toContain("metadata");
    expect(toolIds).toContain("redirect");
    expect(toolIds).toContain("screenshot");
    expect(toolIds).toContain("sitemap");
    expect(toolIds).toContain("robots");
    expect(toolIds).toContain("ssl");
    expect(toolIds).toContain("markdown-fetch");
    expect(toolIds).toContain("uptime");
  });
});

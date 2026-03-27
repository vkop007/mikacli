import { describe, expect, test } from "bun:test";

import { normalizeRobotsUrl, parseRobotsTxt } from "../adapter.js";

describe("robots adapter helpers", () => {
  test("normalizes robots urls", () => {
    expect(normalizeRobotsUrl("https://example.com")).toBe("https://example.com/robots.txt");
    expect(normalizeRobotsUrl("https://example.com/robots.txt")).toBe("https://example.com/robots.txt");
  });

  test("parses simple robots files", () => {
    const parsed = parseRobotsTxt(`
      User-agent: *
      Disallow: /private
      Allow: /public
      Sitemap: https://example.com/sitemap.xml
    `);

    expect(parsed.userAgents).toEqual(["*"]);
    expect(parsed.rules[0]).toMatchObject({
      userAgent: "*",
      allow: ["/public"],
      disallow: ["/private"],
    });
    expect(parsed.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });
});

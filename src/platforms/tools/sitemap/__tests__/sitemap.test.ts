import { describe, expect, test } from "bun:test";

import { normalizeSitemapUrl, parseSitemapDocument } from "../adapter.js";

describe("sitemap adapter helpers", () => {
  test("normalizes site urls to sitemap urls", () => {
    expect(normalizeSitemapUrl("https://example.com")).toBe("https://example.com/sitemap.xml");
    expect(normalizeSitemapUrl("https://example.com/sitemap.xml")).toBe("https://example.com/sitemap.xml");
  });

  test("parses urlset documents", () => {
    const parsed = parseSitemapDocument(`
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/</loc>
          <lastmod>2026-03-27</lastmod>
        </url>
      </urlset>
    `);

    expect(parsed.kind).toBe("urlset");
    expect(parsed.urls[0]).toEqual({
      url: "https://example.com/",
      lastmod: "2026-03-27",
    });
  });
});

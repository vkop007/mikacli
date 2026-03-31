import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";
import { newsPlatformDefinition } from "../manifest.js";
import {
  buildGdeltUrl,
  buildGoogleNewsRssUrl,
  buildRedditHotUrl,
  buildRedditSearchUrl,
  dedupeNewsItems,
  extractNewsPageSummary,
  normalizeNewsSource,
  parseNewsFeedDocument,
  type NewsItem,
} from "../helpers.js";

describe("news provider", () => {
  test("normalizes source names", () => {
    expect(normalizeNewsSource(undefined)).toBe("all");
    expect(normalizeNewsSource("google-news")).toBe("google");
    expect(normalizeNewsSource("hn")).toBe("hn");
    expect(normalizeNewsSource("hackernews")).toBe("hn");
  });

  test("builds source urls", () => {
    expect(buildGoogleNewsRssUrl({ query: "typescript", language: "en", region: "US" })).toContain("news.google.com/rss/search");
    expect(buildGdeltUrl({ query: "open source", limit: 5, language: "en" })).toContain("api.gdeltproject.org");
    expect(buildRedditSearchUrl({ query: "bun cli", limit: 5 })).toContain("reddit.com/search.json");
    expect(buildRedditHotUrl({ subreddit: "news", limit: 5 })).toContain("/r/news/hot.json");
  });

  test("parses rss and atom feeds", () => {
    const rss = `
      <rss>
        <channel>
          <title>Example Feed</title>
          <item>
            <title><![CDATA[Hello World]]></title>
            <link>https://example.com/article</link>
            <description><![CDATA[<p>Useful summary text for the story.</p>]]></description>
            <pubDate>Tue, 25 Mar 2026 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const feed = parseNewsFeedDocument(rss, "https://example.com/feed.xml");
    expect(feed.title).toBe("Example Feed");
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.title).toBe("Hello World");
    expect(feed.items[0]?.url).toBe("https://example.com/article");

    const atom = `
      <feed>
        <title>Atom Feed</title>
        <entry>
          <title>Atom Story</title>
          <link href="https://example.com/atom-story" rel="alternate" />
          <summary>Atom summary</summary>
        </entry>
      </feed>
    `;

    const atomFeed = parseNewsFeedDocument(atom, "https://example.com/atom.xml");
    expect(atomFeed.title).toBe("Atom Feed");
    expect(atomFeed.items).toHaveLength(1);
    expect(atomFeed.items[0]?.url).toBe("https://example.com/atom-story");
  });

  test("dedupes duplicate urls", () => {
    const items: NewsItem[] = [
      { source: "google", sourceLabel: "Google News RSS", title: "One", url: "https://example.com/one" },
      { source: "reddit", sourceLabel: "Reddit JSON", title: "One", url: "https://example.com/one#fragment" },
    ];

    expect(dedupeNewsItems(items, 10)).toHaveLength(1);
  });

  test("extracts page summaries", () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="A clean summary of the article that is long enough to pass the heuristic.">
        </head>
        <body>
          <p>Ignored text.</p>
        </body>
      </html>
    `;

    expect(extractNewsPageSummary(html)).toContain("A clean summary of the article");
  });

  test("builds a command with news capabilities", () => {
    const command = buildPlatformCommand(newsPlatformDefinition);
    expect(command.name()).toBe("news");
    expect(command.commands.map((subcommand: Command) => subcommand.name())).toEqual([
      "sources",
      "top",
      "search",
      "feed",
      "capabilities",
    ]);
  });
});

import { describe, expect, test } from "bun:test";

import { extractMarkdownDocument, normalizePageUrl } from "../adapter.js";

describe("markdown fetch adapter helpers", () => {
  test("normalizes page urls", () => {
    expect(normalizePageUrl("https://example.com/article")).toBe("https://example.com/article");
    expect(normalizePageUrl("example.com/article")).toBe("https://example.com/article");
  });

  test("converts html into readable markdown", () => {
    const parsed = extractMarkdownDocument(
      `
        <html>
          <head>
            <title>Hello page</title>
            <meta name="description" content="Useful page summary">
          </head>
          <body>
            <h1>Heading</h1>
            <p>This is <a href="https://example.com">a link</a>.</p>
            <ul><li>First</li><li>Second</li></ul>
          </body>
        </html>
      `,
      { includeLinks: true, maxChars: 2000 },
    );

    expect(parsed.title).toBe("Hello page");
    expect(parsed.description).toBe("Useful page summary");
    expect(parsed.markdown).toContain("# Heading");
    expect(parsed.markdown).toContain("[a link](https://example.com)");
    expect(parsed.markdown).toContain("- First");
  });
});

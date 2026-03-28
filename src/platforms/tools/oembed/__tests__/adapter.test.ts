import { describe, expect, test } from "bun:test";

import { extractOEmbedEndpoints } from "../adapter.js";

describe("oembed adapter helpers", () => {
  test("extracts discovered json and xml oembed endpoints", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/json+oembed" href="/oembed?format=json&amp;url=https%3A%2F%2Fexample.com%2Fpost%2F123" title="json" />
          <link rel="alternate" type="text/xml+oembed" href="https://example.com/oembed.xml" />
          <link rel="alternate" type="application/json+oembed" href="/oembed?format=json&amp;url=https%3A%2F%2Fexample.com%2Fpost%2F123" />
        </head>
      </html>
    `;

    expect(extractOEmbedEndpoints(html, "https://example.com/post/123")).toEqual([
      {
        url: "https://example.com/oembed?format=json&url=https%3A%2F%2Fexample.com%2Fpost%2F123",
        format: "json",
        title: "json",
      },
      {
        url: "https://example.com/oembed.xml",
        format: "xml",
      },
    ]);
  });
});

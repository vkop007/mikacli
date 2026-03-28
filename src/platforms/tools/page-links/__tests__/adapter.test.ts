import { describe, expect, test } from "bun:test";

import { extractPageLinks } from "../adapter.js";

describe("page links adapter helpers", () => {
  test("extracts internal and external http links", () => {
    const html = `
      <html>
        <body>
          <a href="/docs">Docs</a>
          <a href="https://example.com/about">About</a>
          <a href="https://other.example.org">Other</a>
          <a href="mailto:test@example.com">Mail</a>
        </body>
      </html>
    `;

    const links = extractPageLinks(html, "https://example.com/start");
    expect(links).toEqual([
      { url: "https://example.com/docs", text: "Docs", kind: "internal" },
      { url: "https://example.com/about", text: "About", kind: "internal" },
      { url: "https://other.example.org/", text: "Other", kind: "external" },
    ]);
  });
});

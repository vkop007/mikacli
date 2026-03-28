import { describe, expect, test } from "bun:test";

import { buildFaviconCandidates } from "../adapter.js";

describe("favicon adapter helpers", () => {
  test("extracts declared icons and appends favicon.ico fallback", async () => {
    const html = `
      <html>
        <head>
          <link rel="icon" href="/favicon-32x32.png" sizes="32x32">
          <link rel="apple-touch-icon" href="https://cdn.example.com/apple-touch-icon.png">
        </head>
      </html>
    `;

    const candidates = await buildFaviconCandidates(html, "https://example.com/page", 1, false);
    expect(candidates.map((candidate) => candidate.url)).toContain("https://example.com/favicon-32x32.png");
    expect(candidates.map((candidate) => candidate.url)).toContain("https://cdn.example.com/apple-touch-icon.png");
    expect(candidates.map((candidate) => candidate.url)).toContain("https://example.com/favicon.ico");
  });
});

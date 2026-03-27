import { describe, expect, test } from "bun:test";

import { normalizeDocumentFormat, parseMdlsOutput } from "../adapter.js";

describe("document editor", () => {
  test("normalizes supported formats", () => {
    expect(normalizeDocumentFormat("DOCX")).toBe("docx");
    expect(normalizeDocumentFormat("md")).toBe("md");
  });

  test("rejects unsupported formats", () => {
    expect(() => normalizeDocumentFormat("pdf")).toThrow();
  });

  test("parses mdls-style output", () => {
    expect(parseMdlsOutput('kMDItemKind = "Rich Text Document"\nkMDItemFSSize = 1234')).toEqual({
      kMDItemKind: '"Rich Text Document"',
      kMDItemFSSize: "1234",
    });
  });
});

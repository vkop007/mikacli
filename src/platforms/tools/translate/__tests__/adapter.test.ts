import { afterEach, describe, expect, test } from "bun:test";

import { parseMyMemoryResponse, translateAdapter } from "../adapter.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("translate adapter", () => {
  test("parses a mymemory translate response payload", () => {
    const parsed = parseMyMemoryResponse({
      responseStatus: 200,
      responseData: {
        translatedText: "हैलो वर्ल्ड",
        match: 0.91,
      },
    });

    expect(parsed).toEqual({
      translatedText: "हैलो वर्ल्ड",
      confidence: 0.91,
    });
  });

  test("translates text using the mymemory endpoint", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          responseStatus: 200,
          responseData: {
            translatedText: "हैलो वर्ल्ड",
            match: 0.91,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as unknown as typeof globalThis.fetch;

    const result = await translateAdapter.translate({
      text: "hello world",
      from: "auto",
      to: "hi",
    });

    expect(result.ok).toBe(true);
    expect(String(result.platform)).toBe("translate");
    expect(result.data?.translatedText).toBe("हैलो वर्ल्ड");
    expect(result.data?.targetLanguage).toBe("hi");
  });
});

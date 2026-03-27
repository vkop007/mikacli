import { afterEach, describe, expect, test } from "bun:test";

import { parseGoogleTranslateResponse, translateAdapter } from "../adapter.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("translate adapter", () => {
  test("parses a google translate response payload", () => {
    const parsed = parseGoogleTranslateResponse([
      [["hola mundo", "hello world", null, null, 10]],
      null,
      "en",
      null,
      null,
      null,
      0.91,
    ]);

    expect(parsed).toEqual({
      translatedText: "hola mundo",
      sourceLanguage: "en",
      confidence: 0.91,
    });
  });

  test("translates text using the public google endpoint", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([[["हैलो वर्ल्ड", "hello world"]], null, "en", null, null, null, 0.763]), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof globalThis.fetch;

    const result = await translateAdapter.translate({
      text: "hello world",
      from: "auto",
      to: "hi",
    });

    expect(result.ok).toBe(true);
    expect(String(result.platform)).toBe("translate");
    expect(result.data?.translatedText).toBe("हैलो वर्ल्ड");
    expect(result.data?.sourceLanguage).toBe("en");
    expect(result.data?.targetLanguage).toBe("hi");
  });
});

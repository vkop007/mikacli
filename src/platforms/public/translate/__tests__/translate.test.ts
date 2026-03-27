import { describe, expect, test } from "bun:test";

import { buildTranslateUrl, parseTranslateResponse } from "../adapter.js";

describe("translate adapter helpers", () => {
  test("builds the Google translate url", () => {
    const url = buildTranslateUrl({ text: "Hello world", from: "auto", to: "fr" });
    expect(url).toContain("translate.googleapis.com");
    expect(url).toContain("client=gtx");
    expect(url).toContain("sl=auto");
    expect(url).toContain("tl=fr");
  });

  test("parses the nested translation payload", () => {
    const parsed = parseTranslateResponse([[["Bonjour", "Hello", null, null, 1]], null, "en"]);
    expect(parsed).toEqual({
      translatedText: "Bonjour",
      detectedSourceLanguage: "en",
    });
  });
});

import { describe, expect, test } from "bun:test";

import { buildDnsResolveUrl, normalizeDnsName, normalizeDnsType, parseDnsAnswers } from "../adapter.js";

describe("dns public tools", () => {
  test("normalizes the lookup target and record type", () => {
    expect(normalizeDnsName("openai.com.")).toBe("openai.com");
    expect(normalizeDnsType("mx")).toBe("MX");
  });

  test("builds the public DNS over HTTPS url", () => {
    expect(buildDnsResolveUrl({ name: "openai.com", type: "A" })).toBe(
      "https://dns.google/resolve?name=openai.com&type=A",
    );
  });

  test("parses dns answers from google dns json", () => {
    const answers = parseDnsAnswers({
      Answer: [{ name: "openai.com.", type: 1, TTL: 60, data: "104.18.12.123" }],
    });

    expect(answers).toEqual([
      {
        name: "openai.com.",
        type: "A",
        ttl: 60,
        data: "104.18.12.123",
      },
    ]);
  });
});

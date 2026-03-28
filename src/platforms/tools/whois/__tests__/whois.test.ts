import { describe, expect, test } from "bun:test";

import { buildWhoisSourceUrl, detectWhoisTargetKind, normalizeWhoisTarget, parseWhoisResult } from "../adapter.js";

describe("whois public tools", () => {
  test("normalizes the lookup target and detects the target kind", () => {
    expect(normalizeWhoisTarget("OpenAI.com")).toBe("openai.com");
    expect(detectWhoisTargetKind("openai.com")).toBe("domain");
    expect(detectWhoisTargetKind("8.8.8.8")).toBe("ip");
  });

  test("builds the rdap.org source url", () => {
    expect(buildWhoisSourceUrl("domain", "openai.com")).toBe("https://rdap.org/domain/openai.com");
    expect(buildWhoisSourceUrl("ip", "8.8.8.8")).toBe("https://rdap.org/ip/8.8.8.8");
  });

  test("parses rdap payloads into a usable whois result", () => {
    const result = parseWhoisResult(
      {
        objectClassName: "domain",
        ldhName: "openai.com",
        handle: "OPENAI-COM",
        status: ["active"],
        nameservers: [{ ldhName: "ns1.example.com" }, { ldhName: "ns2.example.com" }],
        events: [{ eventAction: "registration", eventDate: "2023-01-01T00:00:00Z" }],
        entities: [
          {
            roles: ["registrar"],
            vcardArray: ["vcard", [["fn", {}, "text", "Example Registrar"]]],
          },
        ],
        notices: [{ title: "Notice", description: ["Example"] }],
      },
      {
        kind: "domain",
        target: "openai.com",
        sourceUrl: "https://rdap.org/domain/openai.com",
      },
    );

    expect(result.registrar).toBe("Example Registrar");
    expect(result.nameservers).toEqual(["ns1.example.com", "ns2.example.com"]);
    expect(result.events).toEqual([{ action: "registration", date: "2023-01-01T00:00:00Z" }]);
  });
});

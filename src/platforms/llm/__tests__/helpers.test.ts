import { describe, expect, test } from "bun:test";

import { buildCookieLlmSessionStatus } from "../shared/helpers.js";

describe("llm shared helpers", () => {
  test("marks sessions active when expected auth cookies are present", () => {
    const status = buildCookieLlmSessionStatus({
      displayName: "ChatGPT",
      cookieNames: ["__Secure-next-auth.session-token", "oai-did"],
      authCookieNames: ["__Secure-next-auth.session-token", "_puid"],
    });

    expect(status.state).toBe("active");
  });

  test("marks sessions unknown when auth cookie detection is not configured", () => {
    const status = buildCookieLlmSessionStatus({
      displayName: "Grok",
      cookieNames: ["some-cookie"],
      authCookieNames: [],
    });

    expect(status.state).toBe("unknown");
  });

  test("marks sessions expired when required auth cookies are missing", () => {
    const status = buildCookieLlmSessionStatus({
      displayName: "Gemini",
      cookieNames: ["NID", "AEC"],
      authCookieNames: ["SAPISID", "__Secure-1PSID"],
    });

    expect(status.state).toBe("expired");
  });
});

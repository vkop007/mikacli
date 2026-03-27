import { describe, expect, test } from "bun:test";

import { CookieManager } from "../cookie-manager.js";

describe("cookie manager imports", () => {
  test("preserves host-only cookies from browser JSON exports", async () => {
    const manager = new CookieManager();
    const jar = await manager.parseCookieJson(
      "grok",
      JSON.stringify([
        {
          name: "sso",
          value: "host-only",
          domain: "grok.com",
          hostOnly: true,
          path: "/",
          secure: true,
        },
        {
          name: "sso-rw",
          value: "shared",
          domain: ".grok.com",
          hostOnly: false,
          path: "/",
          secure: true,
        },
      ]),
    );

    const cookies = await jar.getCookies("https://grok.com/");
    expect(cookies.find((cookie) => cookie.key === "sso")?.hostOnly).toBe(true);
    expect(cookies.find((cookie) => cookie.key === "sso-rw")?.hostOnly).toBe(false);
  });

  test("preserves the include-subdomains flag from Netscape cookie files", async () => {
    const manager = new CookieManager();
    const jar = await manager.parseNetscapeCookies(
      "grok",
      [
        "grok.com\tFALSE\t/\tTRUE\t2147483647\tsso\thost-only",
        ".grok.com\tTRUE\t/\tTRUE\t2147483647\tsso-rw\tshared",
      ].join("\n"),
    );

    const cookies = await jar.getCookies("https://grok.com/");
    expect(cookies.find((cookie) => cookie.key === "sso")?.hostOnly).toBe(true);
    expect(cookies.find((cookie) => cookie.key === "sso-rw")?.hostOnly).toBe(false);
  });
});

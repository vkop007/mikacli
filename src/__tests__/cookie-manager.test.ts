import { describe, expect, test } from "bun:test";

import { CookieManager } from "../utils/cookie-manager.js";

describe("CookieManager", () => {
  test("parses Netscape cookies.txt input", async () => {
    const manager = new CookieManager();
    const jar = await manager.parseNetscapeCookies(
      "instagram",
      `# Netscape HTTP Cookie File
.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\tabc123
.instagram.com\tTRUE\t/\tTRUE\t2147483647\tcsrftoken\tcsrf456`,
    );

    const cookies = await jar.getCookies("https://www.instagram.com/");
    expect(cookies.map((cookie) => cookie.key)).toEqual(["sessionid", "csrftoken"]);
  });

  test("parses a raw cookie string", async () => {
    const manager = new CookieManager();
    const jar = await manager.parseCookieString("x", "auth_token=aaa; ct0=bbb");
    const cookies = await jar.getCookies("https://x.com/");
    expect(cookies.map((cookie) => cookie.key)).toEqual(["auth_token", "ct0"]);
  });

  test("parses a browser cookie JSON array", async () => {
    const manager = new CookieManager();
    const jar = await manager.parseCookieJson(
      "x",
      JSON.stringify([
        {
          name: "auth_token",
          value: "aaa",
          domain: ".x.com",
          path: "/",
          secure: true,
        },
      ]),
    );
    const cookies = await jar.getCookies("https://x.com/");
    expect(cookies[0]?.key).toBe("auth_token");
  });
});

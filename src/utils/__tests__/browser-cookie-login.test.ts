import { describe, expect, it } from "bun:test";

import {
  extractManagedBrowserProcessCandidates,
  hasDetectedSharedBrowserBootstrap,
  hasDetectedAuthenticatedState,
  normalizePlaywrightCookie,
  resolveSharedBrowserBootstrapDetector,
  resolveManagedBrowserConnectEndpoint,
} from "../browser-cookie-login.js";

describe("browser cookie login detection", () => {
  it("does not treat GitHub bootstrap cookies as a successful login", () => {
    const detected = hasDetectedAuthenticatedState(
      [
        { name: "_gh_sess", value: "anon-session", domain: ".github.com" },
        { name: "logged_in", value: "no", domain: ".github.com" },
      ],
      ["user_session", "logged_in"],
      [],
      "github.com",
      {
        localStorage: {},
        sessionStorage: {},
      },
    );

    expect(detected).toBe(false);
  });

  it("treats a real GitHub user_session cookie as authenticated", () => {
    const detected = hasDetectedAuthenticatedState(
      [
        { name: "_gh_sess", value: "anon-session", domain: ".github.com" },
        { name: "user_session", value: "signed-in-session", domain: ".github.com" },
      ],
      ["user_session", "logged_in"],
      [],
      "github.com",
      {
        localStorage: {},
        sessionStorage: {},
      },
    );

    expect(detected).toBe(true);
  });

  it("supports storage-backed login detection for platforms like DeepSeek", () => {
    const detected = hasDetectedAuthenticatedState(
      [{ name: "visitor_id", value: "abc123", domain: ".deepseek.com" }],
      [],
      ["userToken"],
      "deepseek.com",
      {
        localStorage: {
          userToken: "browser-user-token",
        },
        sessionStorage: {},
      },
    );

    expect(detected).toBe(true);
  });

  it("can require a stronger ready-cookie set before browser login completes", () => {
    const missingCsrf = hasDetectedAuthenticatedState(
      [{ name: "li_at", value: "signed-in-session", domain: ".www.linkedin.com" }],
      ["li_at"],
      [],
      "linkedin.com",
      {
        localStorage: {},
        sessionStorage: {},
      },
      ["li_at", "JSESSIONID"],
    );

    const complete = hasDetectedAuthenticatedState(
      [
        { name: "li_at", value: "signed-in-session", domain: ".www.linkedin.com" },
        { name: "JSESSIONID", value: "\"ajax:12345\"", domain: ".www.linkedin.com" },
      ],
      ["li_at"],
      [],
      "linkedin.com",
      {
        localStorage: {},
        sessionStorage: {},
      },
      ["li_at", "JSESSIONID"],
    );

    expect(missingCsrf).toBe(false);
    expect(complete).toBe(true);
  });

  it("normalizes serialized session cookies into Playwright cookie objects", () => {
    const cookie = normalizePlaywrightCookie({
      key: "reddit_session",
      value: "session-value",
      domain: ".reddit.com",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      expires: "2030-01-01T00:00:00.000Z",
    });

    expect(cookie).toEqual({
      name: "reddit_session",
      value: "session-value",
      domain: ".reddit.com",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
      expires: 1893456000,
    });
  });

  it("widens apex-domain cookies for subdomain browser actions", () => {
    const cookie = normalizePlaywrightCookie(
      {
        key: "reddit_session",
        value: "session-value",
        domain: "reddit.com",
        path: "/",
        secure: true,
      },
      {
        targetUrl: "https://old.reddit.com/r/test/submit?selftext=true",
      },
    );

    expect(cookie).toEqual({
      name: "reddit_session",
      value: "session-value",
      domain: ".reddit.com",
      path: "/",
      secure: true,
    });
  });

  it("prefers Chrome's websocket debugger URL when connecting to the shared browser", () => {
    const endpoint = resolveManagedBrowserConnectEndpoint("http://127.0.0.1:9222", {
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc123",
    });

    expect(endpoint).toBe("ws://127.0.0.1:9222/devtools/browser/abc123");
  });

  it("falls back to the plain CDP endpoint when Chrome does not report a websocket debugger URL", () => {
    const endpoint = resolveManagedBrowserConnectEndpoint("http://127.0.0.1:9222", {
      browser: "Chrome/146.0.0.0",
    });

    expect(endpoint).toBe("http://127.0.0.1:9222");
  });

  it("extracts reusable managed-browser processes and skips helper processes", () => {
    const candidates = extractManagedBrowserProcessCandidates(
      `
15424 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/Users/example/.mikacli/browser/default --remote-debugging-port=50345 --no-first-run
15483 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/146.0.7680.178/Helpers/Google Chrome Helper --type=gpu-process --user-data-dir=/Users/example/.mikacli/browser/default --remote-debugging-port=50345
33601 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/var/folders/tmp/mikacli-cdp --remote-debugging-port=51232 --no-first-run
      `,
      "/Users/example/.mikacli/browser/default",
    );

    expect(candidates).toEqual([
      {
        pid: 15424,
        port: 50345,
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      },
    ]);
  });

  it("detects Google bootstrap targets for shared browser login", () => {
    const detector = resolveSharedBrowserBootstrapDetector("https://accounts.google.com/");

    expect(detector).toEqual(
      expect.objectContaining({
        id: "google",
        expectedDomain: "google.com",
      }),
    );
  });

  it("detects a completed Google shared-browser login once strong auth cookies are present", () => {
    const detector = resolveSharedBrowserBootstrapDetector("https://accounts.google.com/");
    expect(detector).toBeDefined();

    const detected = hasDetectedSharedBrowserBootstrap(detector!, {
      finalUrl: "https://myaccount.google.com/",
      cookies: [
        { name: "SID", value: "sid-value", domain: ".google.com" },
        { name: "HSID", value: "hsid-value", domain: ".google.com" },
      ],
      storage: {
        localStorage: {},
        sessionStorage: {},
      },
    });

    expect(detected).toBe(true);
  });

  it("does not treat an in-progress Google sign-in page as a completed shared-browser login", () => {
    const detector = resolveSharedBrowserBootstrapDetector("https://accounts.google.com/");
    expect(detector).toBeDefined();

    const detected = hasDetectedSharedBrowserBootstrap(detector!, {
      finalUrl: "https://accounts.google.com/v3/signin/identifier?continue=https://mail.google.com/",
      cookies: [
        { name: "SID", value: "sid-value", domain: ".google.com" },
        { name: "HSID", value: "hsid-value", domain: ".google.com" },
      ],
      storage: {
        localStorage: {},
        sessionStorage: {},
      },
    });

    expect(detected).toBe(false);
  });
});

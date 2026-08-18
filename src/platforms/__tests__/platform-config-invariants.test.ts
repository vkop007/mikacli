import { describe, expect, it } from "bun:test";

import {
  PLATFORM_CONFIG,
  PLATFORM_NAMES,
  getPlatformBrowserAuthCookieNames,
  getPlatformBrowserReadyCookieNames,
} from "../config.js";

// Known, deliberate deviations. Each entry is a config that does not satisfy an
// invariant below and has not been reconciled yet -- keeping them listed here
// preserves the check for every other platform instead of deleting it.
const ORIGIN_DOMAIN_EXCEPTIONS = new Set<string>([
  // origin points at the atlassian.com marketing page while cookies live on a
  // customer's atlassian.net tenant. Browser login therefore opens a page that
  // can never set the cookies detection waits for. Worth reconciling.
  "confluence",
  // Same Atlassian marketing-page-vs-tenant mismatch as confluence.
  "jira",
]);

function isOfflinePlatform(config: { origin: string }): boolean {
  return !/^https?:\/\//u.test(config.origin);
}

// These invariants guard the platform *data*, not the detection logic. A login
// bug once shipped purely as bad config (a ready-cookie list that mirrored the
// auth list, turning "any of these cookies" into "all of these") and silently
// broke browser login on 23 platforms because nothing validated the table.
describe("platform runtime config invariants", () => {
  it("covers every registered platform", () => {
    expect(PLATFORM_NAMES.length).toBeGreaterThan(0);
    for (const platform of PLATFORM_NAMES) {
      expect(PLATFORM_CONFIG[platform]).toBeDefined();
    }
  });

  it("uses an origin that parses and matches its cookie domain", () => {
    for (const platform of PLATFORM_NAMES) {
      const config = PLATFORM_CONFIG[platform];
      if (isOfflinePlatform(config)) {
        // Offline platforms (hashing, encoding, ...) never make a request, so
        // they declare a sentinel origin rather than a URL.
        continue;
      }

      const origin = new URL(config.origin);
      expect(origin.protocol).toBe("https:");
      if (config.authCookieNames.length === 0 || ORIGIN_DOMAIN_EXCEPTIONS.has(platform)) {
        // API-only platforms point origin at an API host whose domain need not
        // match the cookie domain, because no cookie is ever read for them.
        continue;
      }
      expect(
        origin.hostname === config.cookieDomain || origin.hostname.endsWith(`.${config.cookieDomain}`),
        `${platform}: origin ${origin.hostname} is not within cookieDomain ${config.cookieDomain}`,
      ).toBe(true);
    }
  });

  it("points homeUrl at a page inside the cookie domain", () => {
    // homeUrl is the page browser login opens, so it must be able to set the
    // cookies detection waits for. It need not share the exact origin: several
    // platforms call a dedicated API host (twitch gql.twitch.tv vs www.twitch.tv).
    for (const platform of PLATFORM_NAMES) {
      const config = PLATFORM_CONFIG[platform];
      if (isOfflinePlatform(config) || config.authCookieNames.length === 0 || ORIGIN_DOMAIN_EXCEPTIONS.has(platform)) {
        continue;
      }

      const host = new URL(config.homeUrl).hostname;
      expect(
        host === config.cookieDomain || host.endsWith(`.${config.cookieDomain}`),
        `${platform}: homeUrl host ${host} cannot set cookies on ${config.cookieDomain}`,
      ).toBe(true);
    }
  });

  it("never leaves a cookie name blank or padded", () => {
    for (const platform of PLATFORM_NAMES) {
      const config = PLATFORM_CONFIG[platform];
      const lists = [
        config.authCookieNames,
        config.browserAuthCookieNames ?? [],
        config.browserReadyCookieNames ?? [],
        config.browserAuthStorageKeys ?? [],
      ];
      for (const list of lists) {
        for (const name of list) {
          expect(name.length, `${platform}: empty entry in a cookie/storage list`).toBeGreaterThan(0);
          expect(name, `${platform}: "${name}" has surrounding whitespace`).toBe(name.trim());
        }
      }
    }
  });

  it("does not repeat a cookie name within a single list", () => {
    for (const platform of PLATFORM_NAMES) {
      const config = PLATFORM_CONFIG[platform];
      for (const list of [config.authCookieNames, config.browserAuthCookieNames ?? [], config.browserReadyCookieNames ?? []]) {
        expect(new Set(list).size, `${platform}: duplicate cookie name in [${list.join(", ")}]`).toBe(list.length);
      }
    }
  });

  it("keeps an explicit ready list inside the browser auth list", () => {
    // A ready cookie is an AND-gate applied *after* an auth cookie matched. It
    // need not be an auth candidate itself, but gating on a cookie the platform
    // never declares at all is almost certainly a typo.
    for (const platform of PLATFORM_NAMES) {
      const explicitReady = PLATFORM_CONFIG[platform].browserReadyCookieNames;
      if (!explicitReady) {
        continue;
      }

      const knownNames = new Set([
        ...getPlatformBrowserAuthCookieNames(platform),
        ...PLATFORM_CONFIG[platform].authCookieNames,
      ]);
      const orphaned = explicitReady.filter((name) => !knownNames.has(name));
      expect(orphaned, `${platform}: ready cookies [${orphaned.join(", ")}] are not declared cookies`).toEqual([]);
    }
  });

  it("does not silently promote the auth OR-list into an all-required AND-list", () => {
    // Regression guard for the original defect: an unset browserReadyCookieNames
    // must resolve to no extra gate, never to a copy of the auth list.
    for (const platform of PLATFORM_NAMES) {
      if (PLATFORM_CONFIG[platform].browserReadyCookieNames) {
        continue;
      }

      expect(
        getPlatformBrowserReadyCookieNames(platform),
        `${platform}: unset ready list must default to []`,
      ).toEqual([]);
    }
  });

  it("declares some way to recognize a session for cookie-auth platforms", () => {
    for (const platform of PLATFORM_NAMES) {
      const config = PLATFORM_CONFIG[platform];
      if (config.authCookieNames.length === 0) {
        continue;
      }

      expect(
        getPlatformBrowserAuthCookieNames(platform).length + (config.browserAuthStorageKeys ?? []).length,
        `${platform}: no browser auth signal declared`,
      ).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, test } from "bun:test";

import { buildRequestUrl, rankHttpPlatformCandidates, summarizeCapturedRequests } from "../adapter.js";

describe("http toolkit helpers", () => {
  test("ranks GitHub for github.com targets", () => {
    expect(rankHttpPlatformCandidates("github.com")).toContain("github");
  });

  test("prefers Confluence when the URL path lives under /wiki", () => {
    expect(rankHttpPlatformCandidates("officialgxdyt.atlassian.net", "https://officialgxdyt.atlassian.net/wiki/spaces/ENG")).toEqual([
      "confluence",
      "jira",
    ]);
  });

  test("prefers Jira when the URL path looks like an issue or Jira REST call", () => {
    expect(rankHttpPlatformCandidates("officialgxdyt.atlassian.net", "https://officialgxdyt.atlassian.net/rest/api/3/myself")).toEqual([
      "jira",
      "confluence",
    ]);
  });

  test("builds full request URLs from relative paths", () => {
    expect(buildRequestUrl("/settings/profile", "https://github.com/")).toBe("https://github.com/settings/profile");
    expect(buildRequestUrl("settings/profile", "https://github.com")).toBe("https://github.com/settings/profile");
  });

  test("summarizes captured requests by normalized endpoint", () => {
    const summary = summarizeCapturedRequests([
      {
        method: "GET",
        url: "https://github.com/settings/profile?tab=public_profile",
        status: 200,
        resourceType: "document",
      },
      {
        method: "POST",
        url: "https://github.com/settings/profile",
        status: 200,
        resourceType: "fetch",
      },
    ], "endpoint");

    expect(summary.groups).toEqual([
      {
        key: "https://github.com/settings/profile",
        count: 2,
        methods: ["GET", "POST"],
        statuses: [200],
        resourceTypes: ["document", "fetch"],
        sampleUrl: "https://github.com/settings/profile?tab=public_profile",
      },
    ]);
  });

  test("can group captured requests by method", () => {
    const summary = summarizeCapturedRequests([
      {
        method: "GET",
        url: "https://github.com/settings/profile",
        status: 200,
        resourceType: "document",
      },
      {
        method: "POST",
        url: "https://github.com/session",
        status: 302,
        resourceType: "fetch",
      },
    ], "method");

    expect(summary.groups.map((group) => group.key)).toEqual(["GET", "POST"]);
  });
});

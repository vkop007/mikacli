import { describe, expect, it } from "bun:test";

import { encodeGitLabProjectTarget, getGitLabRuntimeBaseUrl, normalizeGitLabProjectTarget, normalizeGitLabState } from "../platforms/developer/gitlab/helpers.js";

describe("gitlab helpers", () => {
  it("normalizes project targets from ids, paths, and urls", () => {
    expect(normalizeGitLabProjectTarget("123")).toBe("123");
    expect(normalizeGitLabProjectTarget("group/subgroup/project")).toBe("group/subgroup/project");
    expect(normalizeGitLabProjectTarget("https://gitlab.com/group/subgroup/project/-/issues/1")).toBe("group/subgroup/project");
  });

  it("encodes project targets for api calls", () => {
    expect(encodeGitLabProjectTarget("group/subgroup/project")).toBe("group%2Fsubgroup%2Fproject");
  });

  it("normalizes issue and merge request states", () => {
    expect(normalizeGitLabState("open")).toBe("opened");
    expect(normalizeGitLabState("closed")).toBe("closed");
    expect(normalizeGitLabState(undefined)).toBe("opened");
  });

  it("resolves the runtime api base url", () => {
    expect(getGitLabRuntimeBaseUrl({ baseUrl: "https://gitlab.example.com" })).toBe("https://gitlab.example.com/api/v4");
  });
});

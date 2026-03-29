import { describe, expect, test } from "bun:test";

import {
  buildOldRedditThreadUrl,
  buildRedditThreadUrl,
  normalizeRedditThingTarget,
  normalizeRedditThreadTarget,
  normalizeRedditUsernameTarget,
} from "../helpers.js";

describe("reddit helpers", () => {
  test("parses reddit profile targets", () => {
    expect(normalizeRedditUsernameTarget("u/spez")).toEqual({
      username: "spez",
      url: "https://www.reddit.com/user/spez/",
    });
    expect(normalizeRedditUsernameTarget("https://www.reddit.com/user/kn0thing/")).toEqual({
      username: "kn0thing",
      url: "https://www.reddit.com/user/kn0thing/",
    });
  });

  test("parses reddit thread targets", () => {
    expect(normalizeRedditThreadTarget("1abc123")).toEqual({
      postId: "1abc123",
      url: "https://www.reddit.com/comments/1abc123",
    });
    expect(
      normalizeRedditThreadTarget("https://www.reddit.com/r/programming/comments/1abc123/example_post/def456/"),
    ).toEqual({
      postId: "1abc123",
      commentId: "def456",
      subreddit: "programming",
      url: "https://www.reddit.com/r/programming/comments/1abc123/example_post/def456/",
    });
  });

  test("parses reddit thing targets and builds urls", () => {
    expect(normalizeRedditThingTarget("t3_1abc123")).toEqual({
      postId: "1abc123",
      fullname: "t3_1abc123",
      url: "https://www.reddit.com/comments/1abc123",
    });
    expect(normalizeRedditThingTarget("https://www.reddit.com/r/programming/comments/1abc123/example_post/def456/")).toEqual({
      postId: "1abc123",
      commentId: "def456",
      subreddit: "programming",
      fullname: "t1_def456",
      url: "https://www.reddit.com/r/programming/comments/1abc123/example_post/def456/",
    });
    expect(buildRedditThreadUrl({ postId: "1abc123", subreddit: "programming", commentId: "def456" })).toBe(
      "https://www.reddit.com/r/programming/comments/1abc123/_/def456",
    );
    expect(buildOldRedditThreadUrl({ postId: "1abc123" })).toBe("https://old.reddit.com/comments/1abc123");
  });
});

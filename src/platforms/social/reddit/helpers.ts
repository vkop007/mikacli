import { AutoCliError } from "../../../errors.js";

const REDDIT_ORIGIN = "https://www.reddit.com";

export interface RedditProfileTarget {
  username: string;
  url?: string;
}

export interface RedditThreadTarget {
  postId: string;
  commentId?: string;
  subreddit?: string;
  url?: string;
}

export interface RedditThingTarget extends RedditThreadTarget {
  fullname: string;
}

export function normalizeRedditUsernameTarget(target: string): RedditProfileTarget {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("REDDIT_TARGET_INVALID", "Expected a Reddit username, u/username, or profile URL.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const match = url.pathname.match(/^\/(?:user|u)\/([^/]+)\/?/iu);
    if (match?.[1]) {
      return {
        username: decodeURIComponent(match[1]),
        url: url.toString(),
      };
    }
  }

  const normalized = trimmed.replace(/^u\//iu, "").replace(/^@/u, "");
  if (/^[A-Za-z0-9_-]+$/u.test(normalized)) {
    return {
      username: normalized,
      url: `${REDDIT_ORIGIN}/user/${encodeURIComponent(normalized)}/`,
    };
  }

  throw new AutoCliError("REDDIT_TARGET_INVALID", "Expected a Reddit username, u/username, or profile URL.");
}

export function normalizeRedditSubredditTarget(target: string): string {
  const normalized = target.trim().replace(/^r\//iu, "").replace(/^\/+|\/+$/gu, "");
  if (!/^[A-Za-z0-9_]+$/u.test(normalized)) {
    throw new AutoCliError("REDDIT_SUBREDDIT_INVALID", "Expected a subreddit like r/programming or programming.");
  }
  return normalized;
}

export function normalizeRedditThreadTarget(target: string): RedditThreadTarget {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("REDDIT_THREAD_INVALID", "Expected a Reddit post URL, shortlink, or post ID.");
  }

  if (/^t3_[A-Za-z0-9]+$/u.test(trimmed)) {
    return {
      postId: trimmed.slice(3),
      url: `${REDDIT_ORIGIN}/comments/${encodeURIComponent(trimmed.slice(3))}`,
    };
  }

  if (/^[A-Za-z0-9]+$/u.test(trimmed)) {
    return {
      postId: trimmed,
      url: `${REDDIT_ORIGIN}/comments/${encodeURIComponent(trimmed)}`,
    };
  }

  if (/^https?:\/\/(?:www\.)?redd\.it\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const postId = url.pathname.split("/").filter(Boolean)[0];
    if (postId && /^[A-Za-z0-9]+$/u.test(postId)) {
      return {
        postId,
        url: `${REDDIT_ORIGIN}/comments/${encodeURIComponent(postId)}`,
      };
    }
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    const commentsIndex = segments.findIndex((segment) => segment.toLowerCase() === "comments");
    if (commentsIndex >= 0) {
      const subreddit = segments[commentsIndex - 1];
      const postId = segments[commentsIndex + 1];
      const commentId = segments[commentsIndex + 3];
      if (postId && /^[A-Za-z0-9]+$/u.test(postId)) {
        return {
          postId,
          ...(commentId && /^[A-Za-z0-9]+$/u.test(commentId) ? { commentId } : {}),
          ...(subreddit ? { subreddit: decodeURIComponent(subreddit) } : {}),
          url: url.toString(),
        };
      }
    }
  }

  throw new AutoCliError("REDDIT_THREAD_INVALID", "Expected a Reddit post URL, shortlink, or post ID.");
}

export function normalizeRedditThingTarget(target: string): RedditThingTarget {
  const trimmed = target.trim();
  if (/^t[13]_[A-Za-z0-9]+$/u.test(trimmed)) {
    return {
      postId: trimmed.startsWith("t3_") ? trimmed.slice(3) : "",
      ...(trimmed.startsWith("t1_") ? { commentId: trimmed.slice(3) } : {}),
      fullname: trimmed,
      url: trimmed.startsWith("t3_") ? `${REDDIT_ORIGIN}/comments/${encodeURIComponent(trimmed.slice(3))}` : undefined,
    };
  }

  const thread = normalizeRedditThreadTarget(trimmed);
  return {
    ...thread,
    fullname: thread.commentId ? `t1_${thread.commentId}` : `t3_${thread.postId}`,
  };
}

export function buildRedditUserUrl(username: string): string {
  return `${REDDIT_ORIGIN}/user/${encodeURIComponent(username)}/`;
}

export function buildRedditThreadUrl(input: { postId: string; subreddit?: string; commentId?: string }): string {
  const base = input.subreddit
    ? `${REDDIT_ORIGIN}/r/${encodeURIComponent(input.subreddit)}/comments/${encodeURIComponent(input.postId)}`
    : `${REDDIT_ORIGIN}/comments/${encodeURIComponent(input.postId)}`;

  if (input.commentId) {
    return `${base}/_/${encodeURIComponent(input.commentId)}`;
  }

  return base;
}

export function buildOldRedditThreadUrl(input: { postId: string; subreddit?: string; commentId?: string }): string {
  return buildRedditThreadUrl(input).replace("https://www.reddit.com", "https://old.reddit.com");
}

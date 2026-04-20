import { MikaCliError } from "../../../errors.js";
import { parseThreadsPostTarget, parseThreadsProfileTarget } from "../../../utils/targets.js";
import { collapseWhitespace } from "../../shopping/shared/helpers.js";
import { normalizeSocialLimit } from "../shared/options.js";

import type { AdapterActionResult } from "../../../types.js";

const THREADS_ORIGIN = "https://www.threads.net";
const THREADS_READABLE_PREFIX = "https://r.jina.ai/http://";
const THREADS_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface ThreadsProfile {
  displayName: string;
  username: string;
  bio?: string;
  followers?: string;
  url: string;
}

interface ThreadsPost {
  id: string;
  username: string;
  displayName?: string;
  text?: string;
  publishedAt?: string;
  url: string;
  metrics?: string[];
}

export class ThreadsAdapter {
  readonly platform = "threads" as const;
  readonly displayName = "Threads";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("THREADS_QUERY_REQUIRED", "Provide a Threads query to search.");
    }

    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const markdown = await this.fetchReadable(`/search?q=${encodeURIComponent(query)}`);
    const items = parseThreadsPostBlocks(markdown).slice(0, limit).map(mapPost);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} Threads result${items.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        items,
      },
    };
  }

  async profileInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = parseThreadsProfileTarget(input.target);
    const url = `${THREADS_ORIGIN}/@${resolved.username}`;
    const markdown = await this.fetchReadable(url);
    const profile = parseThreadsProfile(markdown, url, resolved.username);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "profile",
      message: `Loaded Threads profile ${profile.username}.`,
      id: profile.username,
      url: profile.url,
      user: {
        id: profile.username,
        username: profile.username,
        displayName: profile.displayName,
        profileUrl: profile.url,
      },
      data: {
        profile,
      },
    };
  }

  async posts(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parseThreadsProfileTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const url = `${THREADS_ORIGIN}/@${resolved.username}`;
    const markdown = await this.fetchReadable(url);
    const items = parseThreadsPostBlocks(markdown).slice(0, limit).map(mapPost);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "posts",
      message: `Loaded ${items.length} Threads post${items.length === 1 ? "" : "s"} for ${resolved.username}.`,
      data: {
        target: resolved.username,
        items,
      },
    };
  }

  async threadInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parseThreadsPostTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const url = `${THREADS_ORIGIN}/@${resolved.username}/post/${resolved.postId}`;
    const markdown = await this.fetchReadable(url);
    const posts = parseThreadsPostBlocks(markdown);
    const root = posts[0];
    if (!root) {
      throw new MikaCliError("THREADS_THREAD_NOT_FOUND", "Threads could not load the requested post.", {
        details: {
          target: input.target,
          url,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "thread",
      message: `Loaded Threads post ${root.id}.`,
      id: root.id,
      url: root.url,
      data: {
        thread: mapPost(root),
        replies: posts.slice(1, limit + 1).map(mapPost),
      },
    };
  }

  private async fetchReadable(target: string): Promise<string> {
    const sourceUrl = /^https?:\/\//i.test(target) ? target : `${THREADS_ORIGIN}${target.startsWith("/") ? target : `/${target}`}`;
    const response = await fetch(`${THREADS_READABLE_PREFIX}${sourceUrl.replace(/^https?:\/\//, "")}`, {
      headers: {
        "user-agent": THREADS_USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("THREADS_REQUEST_FAILED", "Failed to load Threads' public page.", {
        details: {
          sourceUrl,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return text;
  }
}

function parseThreadsProfile(markdown: string, url: string, fallbackUsername: string): ThreadsProfile {
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean);
  const headers = lines.filter((line) => line.startsWith("# ")).map((line) => line.slice(2).trim());
  const displayName =
    headers.find((line) => !line.includes("Threads, Say more") && !line.startsWith("Thread ")) ??
    headers[0]?.replace(/\s+\(@[^)]+\)\s+•\s+Threads, Say more$/i, "") ??
    fallbackUsername;

  const usernameIndex = lines.findIndex((line) => line === fallbackUsername || line === `@${fallbackUsername}`);
  const bio = usernameIndex >= 0 ? findNextTextLine(lines, usernameIndex + 1) : undefined;
  const followers = lines.find((line) => /followers/i.test(line))?.replace(/^\[|\]\(.*$/g, "");

  return {
    displayName: displayName.replace(/\s+\(@[^)]+\).*$/i, ""),
    username: fallbackUsername,
    bio: bio && !/followers/i.test(bio) ? bio : undefined,
    followers: collapseWhitespace(followers),
    url,
  };
}

function parseThreadsPostBlocks(markdown: string): ThreadsPost[] {
  const lines = markdown.split("\n").map((line) => line.trim());
  const posts: ThreadsPost[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const postMatch = lines[index]?.match(/^\[([^\]]+)\]\(http:\/\/www\.threads\.net\/@([^/]+)\/post\/([A-Za-z0-9_-]+)(?:[^)]*)\)$/);
    if (!postMatch?.[1] || !postMatch[2] || !postMatch[3]) {
      continue;
    }

    const username = postMatch[2];
    const postId = postMatch[3];
    const displayName = findDisplayName(lines, index, username);
    if (!displayName) {
      continue;
    }
    const contentLines: string[] = [];
    const metrics: string[] = [];

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line) {
        continue;
      }
      if (isNextThreadsPost(lines, cursor)) {
        break;
      }
      if (line.startsWith("![") || line.startsWith("[![") || line.startsWith("[Learn more]") || line.startsWith("Sorry, we're having trouble")) {
        continue;
      }
      if (/^\d+(?:[.,]\d+)?[KMB]?$/i.test(line)) {
        metrics.push(line);
        continue;
      }
      if (/^\[[^\]]+]\(http:\/\/www\.threads\.net\/search\?/i.test(line) || /^\[@[^\]]+]\(http:\/\/www\.threads\.net\/@/i.test(line)) {
        continue;
      }

      const cleaned = cleanThreadsLine(line);
      if (cleaned) {
        contentLines.push(cleaned);
      }
    }

    posts.push({
      id: postId,
      username,
      displayName,
      publishedAt: postMatch[1],
      text: collapseWhitespace(contentLines.join(" ")),
      url: `${THREADS_ORIGIN}/@${username}/post/${postId}`,
      metrics: metrics.slice(0, 4),
    });
  }

  return dedupeThreadsPosts(posts);
}

function mapPost(post: ThreadsPost): Record<string, unknown> {
  const text = post.text?.trim();
  return {
    id: post.id,
    title: text ? text.slice(0, 120) : `${post.username} post`,
    username: post.username,
    text,
    publishedAt: post.publishedAt,
    metrics: post.metrics,
    url: post.url,
  };
}

function findDisplayName(lines: string[], postIndex: number, username: string): string | undefined {
  for (let cursor = Math.max(0, postIndex - 4); cursor < postIndex; cursor += 1) {
    const match = lines[cursor]?.match(/^\[([^\]]+)\]\(http:\/\/www\.threads\.net\/@([^/)]+)\)$/);
    if (match?.[1] && match[2] === username) {
      return match[1];
    }
  }

  return undefined;
}

function isNextThreadsPost(lines: string[], index: number): boolean {
  const current = lines[index];
  if (!current?.match(/^\[[^\]]+]\(http:\/\/www\.threads\.net\/@([^/)]+)\)$/)) {
    return false;
  }

  for (let cursor = index + 1; cursor <= index + 6 && cursor < lines.length; cursor += 1) {
    if (lines[cursor]?.match(/^\[[^\]]+]\(http:\/\/www\.threads\.net\/@[^/]+\/post\/[A-Za-z0-9_-]+/)) {
      return true;
    }
  }

  return false;
}

function findNextTextLine(lines: string[], startIndex: number): string | undefined {
  for (let index = startIndex; index < lines.length && index < startIndex + 8; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    if (line.startsWith("[") || line.startsWith("!") || /^# /.test(line)) {
      continue;
    }
    return collapseWhitespace(line);
  }

  return undefined;
}

function cleanThreadsLine(line: string): string | undefined {
  const withoutLinks = line
    .replace(/\[([^\]]+)]\(http:\/\/www\.threads\.net\/[^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/\[!\[[^\]]*]\([^)]+\)]\([^)]+\)/g, "")
    .trim();
  const collapsed = collapseWhitespace(withoutLinks);
  return collapsed || undefined;
}

function dedupeThreadsPosts(posts: ThreadsPost[]): ThreadsPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) {
      return false;
    }
    seen.add(post.id);
    return true;
  });
}

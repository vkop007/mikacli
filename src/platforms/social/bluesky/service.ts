import { AutoCliError } from "../../../errors.js";
import { parseBlueskyPostTarget, parseBlueskyProfileTarget } from "../../../utils/targets.js";
import { normalizeSocialLimit } from "../shared/options.js";

import type { AdapterActionResult } from "../../../types.js";

const BSKY_PUBLIC_XRPC = "https://public.api.bsky.app/xrpc";
const BSKY_APP_ORIGIN = "https://bsky.app";

interface BlueskyActorSearchResponse {
  actors?: Array<Record<string, unknown>>;
}

interface BlueskyProfileResponse extends Record<string, unknown> {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

interface BlueskyAuthorFeedResponse {
  feed?: Array<Record<string, unknown>>;
}

interface BlueskyThreadResponse {
  thread?: Record<string, unknown>;
}

export class BlueskyAdapter {
  readonly platform = "bluesky" as const;
  readonly displayName = "Bluesky";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("BLUESKY_QUERY_REQUIRED", "Provide a Bluesky query to search.");
    }

    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const response = await this.fetchJson<BlueskyActorSearchResponse>("app.bsky.actor.searchActors", {
      q: query,
      limit: String(limit),
    });
    const items = (response.actors ?? []).map((actor) => mapActor(actor)).filter(Boolean) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} Bluesky profile${items.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        items,
      },
    };
  }

  async profileInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = parseBlueskyProfileTarget(input.target);
    const profile = await this.fetchJson<BlueskyProfileResponse>("app.bsky.actor.getProfile", {
      actor: resolved.actor,
    });
    const mapped = mapProfile(profile);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "profile",
      message: `Loaded Bluesky profile ${mapped.username}.`,
      id: mapped.did as string | undefined,
      url: mapped.url as string | undefined,
      user: {
        id: mapped.did as string | undefined,
        username: mapped.username as string | undefined,
        displayName: mapped.displayName as string | undefined,
        profileUrl: mapped.url as string | undefined,
      },
      data: {
        profile: mapped,
      },
    };
  }

  async posts(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parseBlueskyProfileTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const response = await this.fetchJson<BlueskyAuthorFeedResponse>("app.bsky.feed.getAuthorFeed", {
      actor: resolved.actor,
      limit: String(limit),
    });
    const items = (response.feed ?? [])
      .map((entry) => mapPost((entry as { post?: unknown }).post))
      .filter(Boolean) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "posts",
      message: `Loaded ${items.length} Bluesky post${items.length === 1 ? "" : "s"}.`,
      data: {
        target: resolved.actor,
        items,
      },
    };
  }

  async threadInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const resolved = await this.resolveThreadTarget(input.target);
    const response = await this.fetchJson<BlueskyThreadResponse>("app.bsky.feed.getPostThread", {
      uri: resolved.uri,
      depth: "2",
    });
    const thread = response.thread;
    const root = mapPost((thread as { post?: unknown } | undefined)?.post);
    if (!root) {
      throw new AutoCliError("BLUESKY_THREAD_NOT_FOUND", "Bluesky could not load the requested thread.", {
        details: {
          target: input.target,
          uri: resolved.uri,
        },
      });
    }

    const replies = ((thread as { replies?: unknown[] } | undefined)?.replies ?? [])
      .map((reply) => mapPost((reply as { post?: unknown }).post))
      .filter(Boolean)
      .slice(0, limit) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "thread",
      message: `Loaded Bluesky thread ${String(root.id ?? resolved.uri)}.`,
      id: String(root.id ?? resolved.uri),
      url: String(root.url ?? resolved.url ?? ""),
      data: {
        thread: root,
        replies,
      },
    };
  }

  private async resolveThreadTarget(target: string): Promise<{ uri: string; url?: string }> {
    const parsed = parseBlueskyPostTarget(target);
    if (parsed.uri) {
      return {
        uri: parsed.uri,
      };
    }

    if (!parsed.handle || !parsed.rkey) {
      throw new AutoCliError("BLUESKY_THREAD_TARGET_INVALID", "Expected a Bluesky post URL or at:// URI.", {
        details: { target },
      });
    }

    const profile = await this.fetchJson<BlueskyProfileResponse>("app.bsky.actor.getProfile", {
      actor: parsed.handle,
    });
    if (!profile.did) {
      throw new AutoCliError("BLUESKY_PROFILE_NOT_FOUND", `Bluesky could not resolve ${parsed.handle}.`, {
        details: { target },
      });
    }

    return {
      uri: `at://${profile.did}/app.bsky.feed.post/${parsed.rkey}`,
      url: parsed.url,
    };
  }

  private async fetchJson<T>(method: string, query: Record<string, string>): Promise<T> {
    const url = new URL(`${BSKY_PUBLIC_XRPC}/${method}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        "user-agent": "AutoCLI/1.0 (+https://github.com/vkop007/Pluse)",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new AutoCliError("BLUESKY_REQUEST_FAILED", `Bluesky rejected the ${method} request.`, {
        details: {
          method,
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 500),
        },
      });
    }

    return JSON.parse(text) as T;
  }
}

function mapActor(actor: Record<string, unknown>): Record<string, unknown> | undefined {
  const handle = stringOrUndefined(actor.handle);
  if (!handle) {
    return undefined;
  }

  const displayName = stringOrUndefined(actor.displayName) ?? handle;
  return {
    id: stringOrUndefined(actor.did),
    title: displayName,
    username: handle,
    did: stringOrUndefined(actor.did),
    summary: stringOrUndefined(actor.description),
    followers: formatCount(actor.followersCount),
    url: `${BSKY_APP_ORIGIN}/profile/${handle}`,
  };
}

function mapProfile(profile: BlueskyProfileResponse): Record<string, unknown> {
  const handle = stringOrUndefined(profile.handle) ?? "unknown";
  return {
    displayName: stringOrUndefined(profile.displayName) ?? handle,
    username: handle,
    did: stringOrUndefined(profile.did),
    bio: stringOrUndefined(profile.description),
    followers: formatCount(profile.followersCount),
    following: formatCount(profile.followsCount),
    posts: formatCount(profile.postsCount),
    url: `${BSKY_APP_ORIGIN}/profile/${handle}`,
  };
}

function mapPost(post: unknown): Record<string, unknown> | undefined {
  if (!post || typeof post !== "object") {
    return undefined;
  }

  const typedPost = post as Record<string, unknown>;
  const author = typedPost.author as Record<string, unknown> | undefined;
  const record = typedPost.record as Record<string, unknown> | undefined;
  const handle = stringOrUndefined(author?.handle);
  const uri = stringOrUndefined(typedPost.uri);
  const rkey = uri?.split("/").at(-1);
  const url = handle && rkey ? `${BSKY_APP_ORIGIN}/profile/${handle}/post/${rkey}` : undefined;
  const text = stringOrUndefined(record?.text);

  return {
    id: rkey ?? uri,
    title: text ? text.slice(0, 120) : handle ? `${handle} post` : undefined,
    text,
    username: handle,
    publishedAt: stringOrUndefined(typedPost.indexedAt) ?? stringOrUndefined(record?.createdAt),
    metrics: [
      formatMetric("likes", typedPost.likeCount),
      formatMetric("replies", typedPost.replyCount),
      formatMetric("reposts", typedPost.repostCount),
      formatMetric("quotes", typedPost.quoteCount),
    ].filter((value): value is string => typeof value === "string"),
    url,
  };
}

function formatCount(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMetric(label: string, value: unknown): string | undefined {
  const formatted = formatCount(value);
  return formatted ? `${formatted} ${label}` : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

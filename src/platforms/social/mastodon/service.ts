import { AutoCliError } from "../../../errors.js";
import { normalizeSocialLimit } from "../shared/options.js";
import {
  buildMastodonProfileUrl,
  buildMastodonStatusUrl,
  formatCompactNumber,
  normalizeMastodonInstanceUrl,
  parseMastodonSearchTarget,
  normalizeMastodonStatusTarget,
  trimPreview,
} from "./helpers.js";

import type { AdapterActionResult } from "../../../types.js";

interface MastodonAccount {
  id: string;
  username?: string;
  acct?: string;
  display_name?: string;
  note?: string;
  url?: string;
  followers_count?: number;
  following_count?: number;
  statuses_count?: number;
  avatar?: string;
  avatar_static?: string;
}

interface MastodonStatus {
  id: string;
  uri?: string;
  url?: string;
  content?: string;
  spoiler_text?: string;
  created_at?: string;
  account?: MastodonAccount;
  replies_count?: number;
  reblogs_count?: number;
  favourites_count?: number;
  media_attachments?: Array<{ url?: string; preview_url?: string; type?: string }>;
}

interface MastodonThreadContext {
  ancestors?: MastodonStatus[];
  descendants?: MastodonStatus[];
}

interface MastodonSearchResponse {
  accounts?: MastodonAccount[];
  statuses?: MastodonStatus[];
}

export class MastodonService {
  readonly platform = "mastodon" as const;
  readonly displayName = "Mastodon";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("MASTODON_QUERY_REQUIRED", "Provide a Mastodon query to search.");
    }

    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const items: Record<string, unknown>[] = [];

    if (!/\s/u.test(query)) {
      try {
        const lookup = await this.fetchJson<MastodonAccount>("/api/v1/accounts/lookup", {
          acct: query,
        });
        const mapped = mapAccount(lookup, safeOrigin(lookup.url ?? "") ?? undefined);
        if (mapped) {
          items.push(mapped);
        }
      } catch {
        // Fall through to best-effort public search below.
      }
    }

    if (items.length === 0) {
      const [accountsResponse, statusesResponse] = await Promise.all([
        this.fetchJson<MastodonSearchResponse>("/api/v2/search", {
          q: query,
          limit: String(limit),
          type: "accounts",
          resolve: "false",
          following: "false",
        }),
        this.fetchJson<MastodonSearchResponse>("/api/v2/search", {
          q: query,
          limit: String(limit),
          type: "statuses",
          resolve: "false",
        }),
      ]);

      const publicAccountItems = (accountsResponse.accounts ?? [])
        .map((account) => mapAccount(account, safeOrigin(account.url ?? "") ?? undefined))
        .filter((value): value is Record<string, unknown> => Boolean(value));
      const publicStatusItems = (statusesResponse.statuses ?? [])
        .map((status) =>
          mapStatus(status, safeOrigin(status.url ?? "") ?? safeOrigin(status.account?.url ?? "") ?? undefined),
        )
        .filter((value): value is Record<string, unknown> => Boolean(value));

      items.push(...publicAccountItems, ...publicStatusItems);
    }

    const filteredItems = items
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${filteredItems.length} Mastodon result${filteredItems.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items: filteredItems,
      },
    };
  }

  async profileInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = parseMastodonSearchTarget(input.target);
    const account = await this.resolveAccount(resolved);
    const profile = mapAccount(account);
    if (!profile) {
      throw new AutoCliError("MASTODON_PROFILE_INVALID", "Mastodon returned an unreadable profile.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "profile",
      message: `Loaded Mastodon profile ${String(profile.username ?? profile.title ?? profile.id)}.`,
      id: String(profile.id ?? account.id),
      url: String(profile.url ?? account.url ?? buildMastodonProfileUrl(resolved.baseUrl, String(account.username ?? profile.username ?? ""))),
      user: {
        id: String(profile.id ?? account.id),
        username: String(profile.username ?? account.acct ?? ""),
        displayName: String(profile.displayName ?? account.display_name ?? ""),
        profileUrl: String(profile.url ?? account.url ?? ""),
      },
      data: {
        profile,
      },
    };
  }

  async posts(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parseMastodonSearchTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const account = await this.resolveAccount(resolved);
    const statuses = await this.fetchJson<MastodonStatus[]>(`/api/v1/accounts/${encodeURIComponent(account.id)}/statuses`, {
      limit: String(limit),
      exclude_reblogs: "false",
      exclude_replies: "false",
      pinned: "false",
    }, resolved.baseUrl);

    const items = statuses.map((status) => mapStatus(status, resolved.baseUrl)).filter((value): value is Record<string, unknown> => Boolean(value));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "posts",
      message: `Loaded ${items.length} Mastodon post${items.length === 1 ? "" : "s"}.`,
      data: {
        target: account.acct ?? account.username ?? account.id,
        items,
      },
    };
  }

  async threadInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = normalizeMastodonStatusTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const status = await this.fetchJson<MastodonStatus>(`/api/v1/statuses/${encodeURIComponent(resolved.statusId)}`, {}, resolved.origin);
    const context = await this.fetchJson<MastodonThreadContext>(`/api/v1/statuses/${encodeURIComponent(resolved.statusId)}/context`, {}, resolved.origin);
    const thread = mapStatus(status, resolved.origin);
    if (!thread) {
      throw new AutoCliError("MASTODON_THREAD_INVALID", "Mastodon returned an unreadable thread.");
    }

    const replies = (context.descendants ?? [])
      .map((entry) => mapStatus(entry, resolved.origin))
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "thread",
      message: `Loaded Mastodon thread ${String(thread.id ?? resolved.statusId)}.`,
      id: String(thread.id ?? resolved.statusId),
      url: String(
        thread.url ??
          status.url ??
          buildMastodonStatusUrl(resolved.origin, String(status.account?.username ?? thread.username ?? ""), String(thread.id ?? resolved.statusId)),
      ),
      data: {
        thread,
        replies,
      },
    };
  }

  private async resolveAccount(input: ReturnType<typeof parseMastodonSearchTarget>): Promise<MastodonAccount> {
    if (input.handle && input.handle.length > 0) {
      try {
        const account = await this.fetchJson<MastodonAccount>("/api/v1/accounts/lookup", {
          acct: input.handle,
        }, input.baseUrl);
        if (account?.id) {
          return account;
        }
      } catch (error) {
        if (!(error instanceof AutoCliError) || error.details?.status !== 404) {
          throw error;
        }
      }
    }

    if (input.url) {
      const url = new URL(input.url);
      const pathMatch = url.pathname.match(/^\/@([^/]+)\/?$/u);
      const usersMatch = url.pathname.match(/^\/users\/([^/]+)\/?$/u);
      const handle = pathMatch?.[1] ?? usersMatch?.[1];
      if (handle) {
        try {
          const lookup = await this.fetchJson<MastodonAccount>("/api/v1/accounts/lookup", {
            acct: decodeURIComponent(handle),
          }, input.baseUrl);
          if (lookup?.id) {
            return lookup;
          }
        } catch (error) {
          if (!(error instanceof AutoCliError) || error.details?.status !== 404) {
            throw error;
          }
        }
      }
    }

    throw new AutoCliError("MASTODON_PROFILE_NOT_FOUND", "Mastodon could not find a matching profile.", {
      details: {
        target: input.handle ?? input.url ?? input.baseUrl,
      },
    });
  }
  private async fetchJson<T>(path: string, query: Record<string, string> = {}, baseUrl = "https://mastodon.social"): Promise<T> {
    const url = new URL(path, normalizeMastodonInstanceUrl(baseUrl));
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
        },
      });
    } catch (error) {
      throw new AutoCliError("MASTODON_REQUEST_FAILED", "Failed to reach Mastodon.", {
        cause: error,
        details: {
          url: url.toString(),
        },
      });
    }

    const text = await response.text();
    if (!response.ok) {
      throw new AutoCliError("MASTODON_REQUEST_FAILED", `Mastodon request failed with ${response.status} ${response.statusText}.`, {
        details: {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 500),
        },
      });
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new AutoCliError("MASTODON_RESPONSE_INVALID", "Mastodon returned invalid JSON.", {
        cause: error,
        details: {
          url: url.toString(),
          body: text.slice(0, 500),
        },
      });
    }
  }
}

export const mastodonAdapter = new MastodonService();

function mapAccount(account: MastodonAccount, baseUrl = "https://mastodon.social"): Record<string, unknown> | undefined {
  const acct = account.acct ?? account.username;
  if (!acct) {
    return undefined;
  }

  const origin = account.url ? safeOrigin(account.url) ?? baseUrl : deriveOriginFromAcct(acct) ?? baseUrl;
  const username = account.username ?? acct.split("@", 1)[0] ?? acct;

  return {
    id: account.id,
    title: account.display_name ?? acct,
    username: acct,
    displayName: account.display_name ?? acct,
    summary: trimPreview(account.note),
    followers: formatCompactNumber(account.followers_count),
    following: formatCompactNumber(account.following_count),
    posts: formatCompactNumber(account.statuses_count),
    url: account.url ?? buildMastodonProfileUrl(origin, username),
  };
}

function mapStatus(status: MastodonStatus, baseUrl = "https://mastodon.social"): Record<string, unknown> | undefined {
  const account = status.account;
  const acct = account?.acct ?? account?.username;
  if (!status.id || !acct) {
    return undefined;
  }

  const origin = status.url ? safeOrigin(status.url) ?? baseUrl : account?.url ? safeOrigin(account.url) ?? baseUrl : deriveOriginFromAcct(acct) ?? baseUrl;
  const username = account?.username ?? acct.split("@", 1)[0] ?? acct;
  const text = stripHtml(status.content);
  const title = trimPreview(text, 120) ?? `${acct} post`;
  return {
    id: status.id,
    title,
    text,
    username: acct,
    displayName: account?.display_name,
    publishedAt: status.created_at,
    summary: trimPreview(status.spoiler_text),
    metrics: [
      formatMetric("replies", status.replies_count),
      formatMetric("boosts", status.reblogs_count),
      formatMetric("likes", status.favourites_count),
    ].filter((value): value is string => Boolean(value)),
    url: status.url ?? buildMastodonStatusUrl(origin, username, status.id),
  };
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/p>/giu, "\n\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function formatMetric(label: string, value: number | undefined): string | undefined {
  const formatted = formatCompactNumber(value);
  return formatted ? `${label}=${formatted}` : undefined;
}

function deriveOriginFromAcct(acct: string): string | undefined {
  const host = acct.includes("@") ? acct.split("@").at(-1) : undefined;
  return host ? normalizeMastodonInstanceUrl(host) : undefined;
}

function safeOrigin(target: string): string | undefined {
  try {
    return new URL(target).origin;
  } catch {
    return undefined;
  }
}

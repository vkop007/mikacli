import { MikaCliError } from "../../../errors.js";
import { fetchNewsPageSummary, parseNewsFeedDocument } from "../../news/news/helpers.js";

import type { AdapterActionResult, Platform } from "../../../types.js";
import type { NewsItem } from "../../news/news/helpers.js";

type RssFetchInput = {
  feedUrl: string;
  limit?: number;
  summary?: boolean;
  summaryLimit?: number;
};

export class RssAdapter {
  readonly platform = "rss" as unknown as Platform;
  readonly displayName = "RSS";

  async fetch(input: RssFetchInput): Promise<AdapterActionResult> {
    const feedUrl = normalizeFeedUrl(input.feedUrl);
    const limit = clamp(Math.trunc(input.limit ?? 10), 1, 50);
    const summaryLimit = clamp(Math.trunc(input.summaryLimit ?? 3), 1, 10);

    let response: Response;
    try {
      response = await fetch(feedUrl, {
        signal: AbortSignal.timeout(12000),
        headers: {
          accept: "application/rss+xml,application/atom+xml,text/xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("RSS_REQUEST_FAILED", "Unable to reach the RSS feed.", {
        details: { feedUrl },
        cause: error,
      });
    }

    if (!response.ok) {
      throw new MikaCliError("RSS_REQUEST_FAILED", `RSS feed request failed with ${response.status} ${response.statusText}.`, {
        details: { feedUrl, status: response.status, statusText: response.statusText },
      });
    }

    const xml = await response.text();
    const feed = parseNewsFeedDocument(xml, feedUrl);
    let items: NewsItem[] = feed.items.slice(0, limit).map((item) => ({
      ...item,
      sourceLabel: feed.title ? `RSS: ${feed.title}` : "RSS / Atom",
      feedTitle: feed.title,
    }));

    if (input.summary) {
      items = await attachSummaries(items, summaryLimit);
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "fetch",
      message: `Loaded ${items.length} feed items from ${feed.title ?? feedUrl}.`,
      url: feedUrl,
      data: {
        feedUrl,
        feedTitle: feed.title ?? null,
        limit,
        summaryRequested: Boolean(input.summary),
        summaryLimit: Boolean(input.summary) ? summaryLimit : 0,
        items,
      },
    };
  }
}

export const rssAdapter = new RssAdapter();

function normalizeFeedUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new MikaCliError("RSS_FEED_REQUIRED", "Feed URL cannot be empty.");
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return new URL(`https://${trimmed}`).toString();
  }
}

async function attachSummaries(items: NewsItem[], summaryLimit: number): Promise<NewsItem[]> {
  const output: NewsItem[] = [];
  for (const [index, item] of items.entries()) {
    if (index < summaryLimit) {
      const summary = item.url ? await fetchNewsPageSummary(item.url) : undefined;
      output.push({
        ...item,
        summary: summary ?? undefined,
      });
      continue;
    }

    output.push(item);
  }

  return output;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export { normalizeFeedUrl };

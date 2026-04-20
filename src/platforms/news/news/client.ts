import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult } from "../../../types.js";
import {
  buildGdeltUrl,
  buildGoogleNewsRssUrl,
  buildHackerNewsItemUrl,
  buildHackerNewsTopUrl,
  buildRedditHotUrl,
  buildRedditSearchUrl,
  clamp,
  dedupeNewsItems,
  fetchNewsPageSummary,
  formatNewsSourceScope,
  NEWS_SOURCE_INFO,
  NEWS_SOURCES,
  normalizeNewsSource,
  normalizeOptionalText,
  parseNewsFeedDocument,
  stripHtml,
  type NewsItem,
  type NewsSourceId,
  type NewsSourceInfo,
  type NewsSourceScope,
} from "./helpers.js";

type NewsSourceBatch = {
  source: NewsSourceId;
  label: string;
  requestUrl?: string;
  items: NewsItem[];
};

type NewsSearchInput = {
  query: string;
  source?: string;
  language?: string;
  region?: string;
  subreddit?: string;
  limit?: number;
  summary?: boolean;
  summaryLimit?: number;
};

type NewsTopInput = {
  topic?: string;
  source?: string;
  language?: string;
  region?: string;
  subreddit?: string;
  limit?: number;
  summary?: boolean;
  summaryLimit?: number;
};

type NewsFeedInput = {
  feedUrl: string;
  limit?: number;
  summary?: boolean;
  summaryLimit?: number;
};

type NewsSourcesResult = {
  sources: Array<NewsSourceInfo & { scope: NewsSourceScope }>;
};

export class NewsClient {
  async sources(): Promise<NewsSourcesResult> {
    return {
      sources: NEWS_SOURCES.map((source) => ({
        ...NEWS_SOURCE_INFO[source],
        scope: source,
      })),
    };
  }

  async top(input: NewsTopInput): Promise<AdapterActionResult> {
    const scope = normalizeNewsSource(input.source);
    const limit = clamp(Math.trunc(input.limit ?? 10), 1, 50);
    const summaryLimit = clamp(Math.trunc(input.summaryLimit ?? 3), 1, 10);
    const topic = normalizeOptionalText(input.topic);
    const activeSources = this.resolveSources(scope, ["google", "gdelt", "hn", "reddit"]);

    const settled = await Promise.allSettled(
      activeSources.map(async (source) => this.fetchTopBatch(source, { ...input, topic, limit })),
    );

    return this.buildResultFromBatches({
      action: "top",
      scope,
      requestedSources: activeSources,
      topic,
      limit,
      summaryRequested: Boolean(input.summary),
      summaryLimit,
      batches: settled,
      fallbackMessage: topic ? `Loaded top news results for "${topic}".` : "Loaded top news results.",
    });
  }

  async search(input: NewsSearchInput): Promise<AdapterActionResult> {
    const scope = normalizeNewsSource(input.source);
    const limit = clamp(Math.trunc(input.limit ?? 10), 1, 50);
    const summaryLimit = clamp(Math.trunc(input.summaryLimit ?? 3), 1, 10);
    const query = input.query.trim();

    if (!query) {
      throw new MikaCliError("NEWS_QUERY_REQUIRED", "News search query cannot be empty.");
    }

    const requestedSources: readonly NewsSourceId[] = scope === "all" ? ["google", "gdelt", "reddit"] : [scope];
    if (requestedSources.includes("hn")) {
      throw new MikaCliError("NEWS_SOURCE_UNSUPPORTED", "Hacker News does not offer official query search through its public API.", {
        details: {
          source: "hn",
          query,
        },
      });
    }

    const settled = await Promise.allSettled(
      requestedSources.map(async (source) => this.fetchSearchBatch(source, { ...input, query, limit })),
    );

    return this.buildResultFromBatches({
      action: "search",
      scope,
      requestedSources,
      query,
      limit,
      summaryRequested: Boolean(input.summary),
      summaryLimit,
      batches: settled,
      fallbackMessage: `Loaded news search results for "${query}".`,
    });
  }

  async feed(input: NewsFeedInput): Promise<AdapterActionResult> {
    const feedUrl = this.normalizeFeedUrl(input.feedUrl);
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
      throw new MikaCliError("NEWS_FEED_REQUEST_FAILED", "Unable to reach the news feed URL.", {
        details: { feedUrl },
        cause: error,
      });
    }

    if (!response.ok) {
      throw new MikaCliError("NEWS_FEED_REQUEST_FAILED", `Feed request failed with ${response.status} ${response.statusText}.`, {
        details: {
          feedUrl,
          status: response.status,
        },
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
      items = await this.attachSummaries(items, summaryLimit);
    }

    return this.buildOkResult({
      action: "feed",
      message: `Loaded ${items.length} feed items from ${feed.title ?? feedUrl}.`,
      data: {
        feedUrl,
        feedTitle: feed.title ?? null,
        limit,
        summaryRequested: Boolean(input.summary),
        summaryLimit: Boolean(input.summary) ? summaryLimit : 0,
        sources: [
          {
            source: "rss",
            label: "RSS / Atom",
            count: items.length,
            feedUrl,
          },
        ],
        items,
      },
    });
  }

  private async fetchTopBatch(source: NewsSourceId, input: NewsTopInput): Promise<NewsSourceBatch> {
    switch (source) {
      case "google":
        return this.fetchGoogleTopBatch(input);
      case "gdelt":
        return this.fetchGdeltTopBatch(input);
      case "hn":
        return this.fetchHackerNewsTopBatch(input);
      case "reddit":
        return this.fetchRedditTopBatch(input);
      case "rss":
        throw new MikaCliError("NEWS_SOURCE_UNSUPPORTED", "Generic RSS feeds are only available through the `feed` command.");
    }
  }

  private async fetchSearchBatch(source: NewsSourceId, input: NewsSearchInput): Promise<NewsSourceBatch> {
    switch (source) {
      case "google":
        return this.fetchGoogleSearchBatch(input);
      case "gdelt":
        return this.fetchGdeltSearchBatch(input);
      case "reddit":
        return this.fetchRedditSearchBatch(input);
      case "hn":
      case "rss":
        throw new MikaCliError("NEWS_SOURCE_UNSUPPORTED", `${NEWS_SOURCE_INFO[source].label} is not available for query search.`);
    }
  }

  private async fetchGoogleTopBatch(input: NewsTopInput): Promise<NewsSourceBatch> {
    const query = normalizeOptionalText(input.topic);
    const requestUrl = buildGoogleNewsRssUrl({
      query,
      language: input.language,
      region: input.region,
    });
    return this.fetchGoogleRssBatch({
      source: "google",
      requestUrl,
      limit: input.limit ?? 10,
      topic: query,
    });
  }

  private async fetchGoogleSearchBatch(input: NewsSearchInput): Promise<NewsSourceBatch> {
    const requestUrl = buildGoogleNewsRssUrl({
      query: input.query,
      language: input.language,
      region: input.region,
    });
    return this.fetchGoogleRssBatch({
      source: "google",
      requestUrl,
      limit: input.limit ?? 10,
      topic: input.query,
    });
  }

  private async fetchGoogleRssBatch(input: { source: NewsSourceId; requestUrl: string; limit: number; topic?: string }): Promise<NewsSourceBatch> {
    const xml = await this.fetchText(input.requestUrl, "Google News RSS");
    const feed = parseNewsFeedDocument(xml, input.requestUrl);
    const items = feed.items.slice(0, clamp(Math.trunc(input.limit), 1, 50)).map((item) => ({
      ...item,
      source: input.source,
      sourceLabel: NEWS_SOURCE_INFO[input.source].label,
      query: input.topic,
    }));

    return {
      source: input.source,
      label: NEWS_SOURCE_INFO[input.source].label,
      requestUrl: input.requestUrl,
      items,
    };
  }

  private async fetchGdeltTopBatch(input: NewsTopInput): Promise<NewsSourceBatch> {
    return this.fetchGdeltBatch({
      source: "gdelt",
      requestUrl: buildGdeltUrl({
        query: input.topic,
        limit: input.limit ?? 10,
        language: input.language,
      }),
      query: input.topic,
      limit: input.limit ?? 10,
    });
  }

  private async fetchGdeltSearchBatch(input: NewsSearchInput): Promise<NewsSourceBatch> {
    return this.fetchGdeltBatch({
      source: "gdelt",
      requestUrl: buildGdeltUrl({
        query: input.query,
        limit: input.limit ?? 10,
        language: input.language,
      }),
      query: input.query,
      limit: input.limit ?? 10,
    });
  }

  private async fetchGdeltBatch(input: { source: NewsSourceId; requestUrl: string; query?: string; limit: number }): Promise<NewsSourceBatch> {
    const payload = await this.fetchJson(input.requestUrl, "GDELT DOC 2.0");
    const items = this.parseGdeltPayload(payload, input.source, input.query, input.limit);

    return {
      source: input.source,
      label: NEWS_SOURCE_INFO[input.source].label,
      requestUrl: input.requestUrl,
      items,
    };
  }

  private async fetchHackerNewsTopBatch(input: NewsTopInput): Promise<NewsSourceBatch> {
    const limit = clamp(Math.trunc(input.limit ?? 10), 1, 50);
    const idsPayload = await this.fetchJson(buildHackerNewsTopUrl(), "Hacker News");
    const ids = Array.isArray(idsPayload) ? idsPayload.filter((entry): entry is number => typeof entry === "number") : [];
    const selectedIds = ids.slice(0, limit);
    const settled = await Promise.allSettled(selectedIds.map(async (id) => this.fetchHackerNewsItem(id, input.topic)));
    const items = settled.flatMap((entry) => (entry.status === "fulfilled" && entry.value ? [entry.value] : []));

    return {
      source: "hn",
      label: NEWS_SOURCE_INFO.hn.label,
      requestUrl: buildHackerNewsTopUrl(),
      items,
    };
  }

  private async fetchRedditTopBatch(input: NewsTopInput): Promise<NewsSourceBatch> {
    const requestUrl = buildRedditHotUrl({
      subreddit: input.subreddit,
      limit: input.limit ?? 10,
    });
    const payload = await this.fetchJson(requestUrl, "Reddit");
    return {
      source: "reddit",
      label: NEWS_SOURCE_INFO.reddit.label,
      requestUrl,
      items: this.parseRedditPayload(payload, "reddit", input.topic, input.limit ?? 10),
    };
  }

  private async fetchRedditSearchBatch(input: NewsSearchInput): Promise<NewsSourceBatch> {
    const requestUrl = buildRedditSearchUrl({
      query: input.query,
      subreddit: input.subreddit,
      limit: input.limit ?? 10,
    });
    const payload = await this.fetchJson(requestUrl, "Reddit");
    return {
      source: "reddit",
      label: NEWS_SOURCE_INFO.reddit.label,
      requestUrl,
      items: this.parseRedditPayload(payload, "reddit", input.query, input.limit ?? 10),
    };
  }

  private async fetchHackerNewsItem(id: number, topic?: string): Promise<NewsItem | undefined> {
    const payload = await this.fetchJson(buildHackerNewsItemUrl(id), "Hacker News");
    const item = this.parseHackerNewsItem(payload, topic);
    return item;
  }

  private parseGdeltPayload(payload: unknown, source: NewsSourceId, query: string | undefined, limit: number): NewsItem[] {
    const root = this.asRecord(payload);
    const articles = this.firstArray(root.articles) ?? this.firstArray(root.article) ?? this.firstArray(root.results) ?? [];

    const items = articles
      .map((entry) => this.asRecord(entry))
      .map((entry) => {
        const title = normalizeOptionalText(this.firstString(entry.title) ?? this.firstString(entry.seendate) ?? this.firstString(entry.url));
        const url = normalizeOptionalText(this.firstString(entry.url) ?? this.firstString(entry.sourceUrl) ?? this.firstString(entry.articleUrl));
        if (!title || !url) {
          return undefined;
        }

        const snippet =
          normalizeOptionalText(this.firstString(entry.summary)) ??
          normalizeOptionalText(this.firstString(entry.description)) ??
          normalizeOptionalText(this.firstString(entry.abstract));
        const publishedAt = normalizeOptionalText(this.firstString(entry.seendate) ?? this.firstString(entry.datetime) ?? this.firstString(entry.date));
        const author = normalizeOptionalText(this.firstString(entry.source) ?? this.firstString(entry.domain));

        const item: NewsItem = {
          source,
          sourceLabel: NEWS_SOURCE_INFO[source].label,
          title,
          url,
          snippet,
          publishedAt,
          author,
          query,
        };

        return item;
      })
      .filter((item): item is NewsItem => item !== undefined);

    return dedupeNewsItems(items, limit);
  }

  private parseRedditPayload(payload: unknown, source: NewsSourceId, query: string | undefined, limit: number): NewsItem[] {
    const root = this.asRecord(payload);
    const data = this.asRecord(root.data);
    const children = this.firstArray(data.children) ?? [];

    const items = children
      .map((entry) => this.asRecord(entry))
      .map((entry) => this.asRecord(entry.data))
      .map((entry) => {
        const title = normalizeOptionalText(this.firstString(entry.title));
        const url = normalizeOptionalText(this.firstString(entry.url) ?? this.redditPermalink(this.firstString(entry.permalink)));
        if (!title || !url) {
          return undefined;
        }

        const snippet =
          normalizeOptionalText(this.firstString(entry.selftext)) ??
          normalizeOptionalText(this.firstString(entry.subreddit_name_prefixed)) ??
          normalizeOptionalText(this.firstString(entry.domain));
        const publishedAt = this.epochSecondsToIso(this.asNumber(entry.created_utc));
        const author = normalizeOptionalText(this.firstString(entry.author));

        const item: NewsItem = {
          source,
          sourceLabel: NEWS_SOURCE_INFO[source].label,
          title,
          url,
          snippet: snippet ? stripHtml(snippet) : undefined,
          publishedAt,
          author,
          query,
        };

        return item;
      })
      .filter((item): item is NewsItem => item !== undefined);

    return dedupeNewsItems(items, limit);
  }

  private parseHackerNewsItem(payload: unknown, query: string | undefined): NewsItem | undefined {
    const entry = this.asRecord(payload);
    const title = normalizeOptionalText(this.firstString(entry.title));
    const url = normalizeOptionalText(this.firstString(entry.url) ?? `https://news.ycombinator.com/item?id=${this.asNumber(entry.id) ?? ""}`);
    if (!title || !url) {
      return undefined;
    }

    return {
      source: "hn",
      sourceLabel: NEWS_SOURCE_INFO.hn.label,
      title,
      url,
      snippet: normalizeOptionalText(this.firstString(entry.text)) ? stripHtml(this.firstString(entry.text) ?? "") : undefined,
      publishedAt: this.epochSecondsToIso(this.asNumber(entry.time)),
      author: normalizeOptionalText(this.firstString(entry.by)),
      query,
    };
  }

  private async attachSummaries(items: NewsItem[], summaryLimit: number): Promise<NewsItem[]> {
    const limit = clamp(Math.trunc(summaryLimit), 1, 10);
    let remaining = limit;

    return Promise.all(
      items.map(async (item) => {
        if (remaining <= 0) {
          return item;
        }

        remaining -= 1;
        const summary = await fetchNewsPageSummary(item.url);
        return summary ? { ...item, summary } : item;
      }),
    );
  }

  private async buildResultFromBatches(input: {
    action: string;
    scope: NewsSourceScope;
    requestedSources: readonly NewsSourceId[];
    query?: string;
    topic?: string;
    limit: number;
    summaryRequested: boolean;
    summaryLimit: number;
    batches: PromiseSettledResult<NewsSourceBatch>[];
    fallbackMessage: string;
  }): Promise<AdapterActionResult> {
    const successful = input.batches.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : []));
    const failed = input.batches.flatMap((entry, index) =>
      entry.status === "rejected"
        ? [
            {
              source: input.requestedSources[index] ?? "unknown",
              reason: entry.reason,
              message: entry.reason instanceof Error ? entry.reason.message : "Unknown news request error",
            },
          ]
        : [],
    );

    if (successful.length === 0) {
      if (failed.length === 1 && failed[0]?.reason instanceof MikaCliError) {
        throw failed[0].reason;
      }

      throw new MikaCliError("NEWS_REQUEST_FAILED", "All requested news sources failed.", {
        details: {
          scope: formatNewsSourceScope(input.scope),
          query: input.query ?? input.topic ?? null,
          errors: failed.map(({ source, message }) => ({ source, message })),
        },
      });
    }

    const merged = dedupeNewsItems(successful.flatMap((entry) => entry.items), input.limit);
    const items = input.summaryRequested ? await this.attachSummaries(merged, input.summaryLimit) : merged;

    return this.buildOkResult({
      action: input.action,
      message: input.topic
        ? `${input.fallbackMessage} ${failed.length > 0 ? `(${failed.length} source(s) failed.)` : ""}`.trim()
        : input.fallbackMessage,
      data: {
        scope: formatNewsSourceScope(input.scope),
        query: input.query ?? null,
        topic: input.topic ?? null,
        limit: input.limit,
        summaryRequested: input.summaryRequested,
        summaryLimit: input.summaryRequested ? input.summaryLimit : 0,
        sources: successful.map((batch) => ({
          source: batch.source,
          label: batch.label,
          count: batch.items.length,
          requestUrl: batch.requestUrl ?? null,
        })),
        items,
        errors: failed.map(({ source, message }) => ({ source, message })),
      },
    });
  }

  private buildOkResult(input: { action: string; message: string; data: Record<string, unknown> }): AdapterActionResult {
    return {
      ok: true,
      platform: "news",
      account: "public",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }

  private async fetchText(url: string, label: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          accept: "application/rss+xml,application/atom+xml,text/xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("NEWS_REQUEST_FAILED", `Unable to reach ${label}.`, {
        details: { url },
        cause: error,
      });
    }

    if (!response.ok) {
      throw new MikaCliError("NEWS_REQUEST_FAILED", `${label} request failed with ${response.status} ${response.statusText}.`, {
        details: { url, status: response.status },
      });
    }

    return response.text();
  }

  private async fetchJson(url: string, label: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("NEWS_REQUEST_FAILED", `Unable to reach ${label}.`, {
        details: { url },
        cause: error,
      });
    }

    if (!response.ok) {
      throw new MikaCliError("NEWS_REQUEST_FAILED", `${label} request failed with ${response.status} ${response.statusText}.`, {
        details: { url, status: response.status },
      });
    }

    try {
      return await response.json();
    } catch (error) {
      throw new MikaCliError("NEWS_RESPONSE_INVALID", `${label} returned invalid JSON.`, {
        details: { url },
        cause: error,
      });
    }
  }

  private normalizeFeedUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new MikaCliError("NEWS_FEED_URL_REQUIRED", "Feed URL cannot be empty.");
    }

    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new MikaCliError("NEWS_FEED_URL_INVALID", "Feed URL must use http or https.");
      }
      return url.toString();
    } catch (error) {
      if (error instanceof MikaCliError) {
        throw error;
      }

      throw new MikaCliError("NEWS_FEED_URL_INVALID", `Invalid feed URL "${value}".`, {
        details: { feedUrl: value },
      });
    }
  }

  private resolveSources(scope: NewsSourceScope, defaultSources: NewsSourceId[]): NewsSourceId[] {
    if (scope === "all") {
      return defaultSources;
    }

    return [scope];
  }

  private firstArray(value: unknown): unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object") {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private firstString(value: unknown): string | undefined {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          return entry;
        }
        if (entry && typeof entry === "object" && "value" in entry && typeof (entry as { value?: unknown }).value === "string") {
          return (entry as { value: string }).value;
        }
      }
    }

    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private redditPermalink(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return value.startsWith("http") ? value : `https://www.reddit.com${value}`;
  }

  private epochSecondsToIso(value: number | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}

export const newsClient = new NewsClient();

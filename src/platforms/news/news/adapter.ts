import type { AdapterActionResult, Platform } from "../../../types.js";
import { newsClient } from "./client.js";

export class NewsAdapter {
  readonly platform: Platform = "news";
  readonly displayName = "News";

  async sources(): Promise<AdapterActionResult> {
    const result = await newsClient.sources();
    return this.buildResult({
      action: "sources",
      message: `Loaded ${result.sources.length} supported no-auth news sources.`,
      data: result,
    });
  }

  async top(input: {
    topic?: string;
    source?: string;
    language?: string;
    region?: string;
    subreddit?: string;
    limit?: number;
    summary?: boolean;
    summaryLimit?: number;
  }): Promise<AdapterActionResult> {
    return newsClient.top(input);
  }

  async search(input: {
    query: string;
    source?: string;
    language?: string;
    region?: string;
    subreddit?: string;
    limit?: number;
    summary?: boolean;
    summaryLimit?: number;
  }): Promise<AdapterActionResult> {
    return newsClient.search(input);
  }

  async feed(input: {
    feedUrl: string;
    limit?: number;
    summary?: boolean;
    summaryLimit?: number;
  }): Promise<AdapterActionResult> {
    return newsClient.feed(input);
  }

  private buildResult(input: { action: string; message: string; data: Record<string, unknown> }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const newsAdapter = new NewsAdapter();

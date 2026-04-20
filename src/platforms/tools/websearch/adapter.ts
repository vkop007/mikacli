import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";
import { WebSearchClient } from "./client.js";
import { getWebSearchEngineInfo, normalizeWebSearchEngine, WEB_SEARCH_ENGINES, type WebSearchEngine } from "./helpers.js";

export class WebSearchAdapter {
  readonly platform: Platform = "websearch";
  readonly displayName = "Web Search";

  private readonly client = new WebSearchClient();

  async engines(): Promise<AdapterActionResult> {
    return this.buildResult({
      action: "engines",
      message: `Loaded ${WEB_SEARCH_ENGINES.length} supported search engines.`,
      data: {
        defaultEngine: "duckduckgo",
        engines: WEB_SEARCH_ENGINES.map((engine) => {
          const info = getWebSearchEngineInfo(engine);
          return {
            id: info.id,
            label: info.label,
            description: info.description,
          };
        }),
      },
    });
  }

  async search(input: {
    query: string;
    engine?: string;
    all?: boolean;
    limit?: number;
    summary?: boolean;
    summaryLimit?: number;
  }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("WEBSEARCH_QUERY_REQUIRED", "Search query cannot be empty.");
    }

    const limit = clamp(input.limit ?? 10, 1, 20);
    const engines = input.all ? [...WEB_SEARCH_ENGINES] : [normalizeWebSearchEngine(input.engine)];

    const settled = await Promise.allSettled(
      engines.map(async (engine) => {
        const result = await this.client.search({
          engine,
          query,
          limit,
          summary: Boolean(input.summary),
          summaryLimit: input.summaryLimit,
        });
        return {
          engine,
          searchUrl: result.searchUrl,
          results: result.results,
        };
      }),
    );

    const successful = settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : []));
    const failed = settled.flatMap((entry, index) =>
      entry.status === "rejected"
        ? [
            {
              engine: engines[index],
              reason: entry.reason,
              message: entry.reason instanceof Error ? entry.reason.message : "Unknown search error",
            },
          ]
        : [],
    );

    if (successful.length === 0) {
      if (!input.all && failed.length === 1) {
        const failure = failed[0]?.reason;
        if (failure instanceof MikaCliError) {
          throw failure;
        }

        throw new MikaCliError(
          "WEBSEARCH_ENGINE_FAILED",
          failed[0]?.message ?? "The search engine request failed.",
          {
            details: {
              query,
              engine: engines[0],
            },
            cause: failure,
          },
        );
      }

      throw new MikaCliError("WEBSEARCH_FAILED", "Every configured search engine request failed.", {
        details: {
          query,
          engines,
          errors: failed.map(({ engine, message }) => ({ engine, message })),
        },
      });
    }

    return this.buildResult({
      action: "search",
      message: input.all
        ? `Loaded search results from ${successful.length} engines for "${query}".`
        : `Loaded ${successful[0]?.results.length ?? 0} search results from ${getWebSearchEngineInfo(successful[0]?.engine ?? normalizeWebSearchEngine(input.engine)).label}.`,
      data: {
        query,
        all: Boolean(input.all),
        summaryRequested: Boolean(input.summary),
        summaryLimit: Boolean(input.summary) ? clamp(input.summaryLimit ?? 3, 1, 10) : 0,
        defaultEngine: "duckduckgo",
        engines: successful.map((entry) => ({
          engine: entry.engine,
          label: getWebSearchEngineInfo(entry.engine).label,
          searchUrl: entry.searchUrl,
          count: entry.results.length,
        })),
        results: successful.flatMap((entry) => entry.results),
        errors: failed.map(({ engine, message }) => ({ engine, message })),
      },
    });
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

export const webSearchAdapter = new WebSearchAdapter();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

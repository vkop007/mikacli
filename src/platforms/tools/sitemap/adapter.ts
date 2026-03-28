import { AutoCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type SitemapEntry = {
  url: string;
  lastmod?: string;
};

type SitemapFetchInput = {
  url: string;
  limit?: number;
  depth?: number;
};

export class SitemapAdapter {
  readonly platform = "sitemap" as unknown as Platform;
  readonly displayName = "Sitemap";

  async fetch(input: SitemapFetchInput): Promise<AdapterActionResult> {
    const sitemapUrl = normalizeSitemapUrl(input.url);
    const limit = clamp(Math.trunc(input.limit ?? 100), 1, 5_000);
    const depth = clamp(Math.trunc(input.depth ?? 1), 1, 5);

    const result = await crawlSitemapUrls(sitemapUrl, limit, depth);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "fetch",
      message: `Loaded ${result.urls.length} sitemap URLs from ${sitemapUrl}.`,
      url: sitemapUrl,
      data: {
        sitemapUrl,
        kind: result.kind,
        urls: result.urls,
        childSitemaps: result.childSitemaps,
        limit,
        depth,
        sourceUrl: sitemapUrl,
      },
    };
  }
}

export const sitemapAdapter = new SitemapAdapter();

export function normalizeSitemapUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AutoCliError("SITEMAP_URL_REQUIRED", "Sitemap URL cannot be empty.");
  }

  try {
    const parsed = new URL(trimmed);
    if (/sitemap/i.test(parsed.pathname)) {
      return parsed.toString();
    }
    parsed.pathname = parsed.pathname.replace(/\/?$/, "/sitemap.xml");
    return parsed.toString();
  } catch {
    const parsed = new URL(`https://${trimmed}`);
    if (/sitemap/i.test(parsed.pathname)) {
      return parsed.toString();
    }
    parsed.pathname = parsed.pathname.replace(/\/?$/, "/sitemap.xml");
    return parsed.toString();
  }
}

export async function crawlSitemapUrls(
  sitemapUrl: string,
  limit: number,
  depth: number,
): Promise<{
  kind: "urlset" | "index";
  urls: SitemapEntry[];
  childSitemaps: string[];
}> {
  const visited = new Set<string>();
  const urls: SitemapEntry[] = [];
  const childSitemaps: string[] = [];
  let kind: "urlset" | "index" = "urlset";

  const queue: Array<{ url: string; depth: number }> = [{ url: sitemapUrl, depth }];

  while (queue.length > 0 && urls.length < limit) {
    const current = queue.shift();
    if (!current || visited.has(current.url)) {
      continue;
    }
    visited.add(current.url);

    const xml = await fetchSitemapXml(current.url);
    const parsed = parseSitemapDocument(xml);
    kind = parsed.kind;

    if (parsed.kind === "index" && current.depth > 0) {
      for (const child of parsed.children) {
        childSitemaps.push(child);
        queue.push({ url: child, depth: current.depth - 1 });
      }
      continue;
    }

    for (const entry of parsed.urls) {
      urls.push(entry);
      if (urls.length >= limit) {
        break;
      }
    }
  }

  return { kind, urls, childSitemaps };
}

async function fetchSitemapXml(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        accept: "application/xml,text/xml,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new AutoCliError("SITEMAP_REQUEST_FAILED", "Unable to reach the sitemap URL.", {
      details: { url },
      cause: error,
    });
  }

  if (!response.ok) {
    throw new AutoCliError("SITEMAP_REQUEST_FAILED", `Sitemap request failed with ${response.status} ${response.statusText}.`, {
      details: { url, status: response.status, statusText: response.statusText },
    });
  }

  return response.text();
}

export function parseSitemapDocument(xml: string): {
  kind: "urlset" | "index";
  urls: SitemapEntry[];
  children: string[];
} {
  if (/<sitemapindex\b/i.test(xml)) {
    return {
      kind: "index",
      urls: [],
      children: parseTagValues(xml, "loc"),
    };
  }

  const entries = [...xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)].map((match) => match[0] ?? "");
  const urls: SitemapEntry[] = entries.flatMap((block) => {
    const loc = firstTagValue(block, "loc");
    if (!loc) {
      return [];
    }

    const lastmod = firstTagValue(block, "lastmod");
    const entry: SitemapEntry = { url: loc };
    if (lastmod) {
      entry.lastmod = lastmod;
    }
    return [entry];
  });

  if (urls.length === 0) {
    const fallback = parseTagValues(xml, "loc").map((url) => ({ url }));
    return {
      kind: "urlset",
      urls: fallback,
      children: [],
    };
  }

  return {
    kind: "urlset",
    urls,
    children: [],
  };
}

function firstTagValue(source: string, tagName: string): string | undefined {
  const values = parseTagValues(source, tagName);
  return values[0];
}

function parseTagValues(source: string, tagName: string): string[] {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\/${escaped}>`, "gi");
  return [...source.matchAll(pattern)]
    .map((match) => decodeXmlEntities(stripTags(match[1] ?? "")))
    .map((value) => value.trim())
    .filter(Boolean);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

import { AutoCliError } from "../../../errors.js";
import { extractNewsPageSummary, stripHtml } from "../../news/news/helpers.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type MarkdownFetchInput = {
  url: string;
  maxChars?: number;
  includeLinks?: boolean;
};

export class MarkdownFetchAdapter {
  readonly platform = "markdown-fetch" as unknown as Platform;
  readonly displayName = "Markdown Fetch";

  async fetch(input: MarkdownFetchInput): Promise<AdapterActionResult> {
    const url = normalizePageUrl(input.url);
    const maxChars = clamp(Math.trunc(input.maxChars ?? 6_000), 500, 20_000);
    const includeLinks = Boolean(input.includeLinks);

    const { html, responseUrl } = await fetchHtmlDocument(url);
    const extracted = extractMarkdownDocument(html, { includeLinks, maxChars });
    const summary = extractNewsPageSummary(html);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "fetch",
      message: `Loaded markdown view for ${extracted.title ?? responseUrl}.`,
      url: responseUrl,
      data: {
        url: responseUrl,
        title: extracted.title ?? null,
        description: extracted.description ?? null,
        summary: summary ?? null,
        markdown: extracted.markdown,
        includeLinks,
        maxChars,
        sourceUrl: responseUrl,
      },
    };
  }
}

export const markdownFetchAdapter = new MarkdownFetchAdapter();

export function normalizePageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AutoCliError("MARKDOWN_FETCH_URL_REQUIRED", "Page URL cannot be empty.");
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return new URL(`https://${trimmed}`).toString();
  }
}

export async function fetchHtmlDocument(url: string): Promise<{ html: string; responseUrl: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new AutoCliError("MARKDOWN_FETCH_REQUEST_FAILED", "Unable to reach the page.", {
      details: { url },
      cause: error,
    });
  }

  if (!response.ok) {
    throw new AutoCliError("MARKDOWN_FETCH_REQUEST_FAILED", `Page request failed with ${response.status} ${response.statusText}.`, {
      details: { url, status: response.status, statusText: response.statusText },
    });
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("text/")) {
    throw new AutoCliError("MARKDOWN_FETCH_UNSUPPORTED", "The response does not look like an HTML or text page.");
  }

  return {
    html: await response.text(),
    responseUrl: response.url || url,
  };
}

export function extractMarkdownDocument(
  html: string,
  input: {
    includeLinks: boolean;
    maxChars: number;
  },
): {
  title?: string;
  description?: string;
  markdown: string;
} {
  const title = firstMetaValue(html, "og:title") ?? extractTitle(html);
  const description = firstMetaValue(html, "description") ?? firstMetaValue(html, "og:description");
  const markdown = htmlToMarkdown(html, input.includeLinks).slice(0, input.maxChars).trim();

  return {
    title,
    description,
    markdown,
  };
}

function htmlToMarkdown(html: string, includeLinks: boolean): string {
  let text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ");

  text = text.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, content) => {
    const prefix = "#".repeat(Number.parseInt(level, 10));
    return `\n\n${prefix} ${formatInline(content, includeLinks)}\n\n`;
  });

  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, content) => {
    return `\n- ${formatInline(content, includeLinks)}`;
  });

  text = text.replace(/<(p|div|section|article|main|header|footer|aside|nav|blockquote)\b[^>]*>/gi, "\n\n");
  text = text.replace(/<\/(p|div|section|article|main|header|footer|aside|nav|blockquote)>/gi, "\n\n");
  text = text.replace(/<br\b[^>]*\/?>/gi, "\n");

  if (includeLinks) {
    text = text.replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href, label) => `[${formatInline(label, includeLinks)}](${href.trim()})`,
    );
  }

  text = stripHtml(text);
  return collapseWhitespace(text);
}

function formatInline(value: string, includeLinks: boolean): string {
  return collapseWhitespace(includeLinks ? value : stripHtml(value));
}

function extractTitle(source: string): string | undefined {
  const match = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? collapseWhitespace(stripHtml(match[1] ?? "")) : undefined;
}

function firstMetaValue(source: string, property: string): string | undefined {
  const metaTags = [...source.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  for (const tag of metaTags) {
    const normalized = tag.toLowerCase();
    if (
      normalized.includes(`property="${property.toLowerCase()}"`) ||
      normalized.includes(`property='${property.toLowerCase()}'`) ||
      normalized.includes(`name="${property.toLowerCase()}"`) ||
      normalized.includes(`name='${property.toLowerCase()}'`)
    ) {
      const content = tag.match(/\bcontent="([^"]*)"/i)?.[1] ?? tag.match(/\bcontent='([^']*)'/i)?.[1];
      if (content) {
        return collapseWhitespace(stripHtml(content));
      }
    }
  }

  return undefined;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

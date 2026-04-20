import { MikaCliError } from "../../../errors.js";
import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type MetadataInput = {
  target: string;
  timeoutMs?: number;
};

export class MetadataAdapter {
  readonly platform: Platform = "metadata" as Platform;
  readonly displayName = "Metadata";

  async inspect(input: MetadataInput): Promise<AdapterActionResult> {
    const target = normalizePublicHttpUrl(input.target);
    const timeoutMs = clampNumber(input.timeoutMs ?? 15000, 1000, 60000);
    const response = await fetchPage(target, timeoutMs);
    const metadata = extractMetadata(response.html, response.finalUrl);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "metadata",
      message: `Loaded page metadata from ${response.finalUrl}.`,
      url: response.finalUrl,
      data: {
        target,
        finalUrl: response.finalUrl,
        status: response.status,
        statusText: response.statusText,
        title: metadata.title,
        description: metadata.description,
        canonicalUrl: metadata.canonicalUrl,
        faviconUrl: metadata.faviconUrl,
        htmlLang: metadata.htmlLang,
        openGraph: metadata.openGraph,
        twitter: metadata.twitter,
      },
    };
  }
}

export const metadataAdapter = new MetadataAdapter();

async function fetchPage(target: string, timeoutMs: number): Promise<{
  finalUrl: string;
  status: number;
  statusText: string;
  html: string;
}> {
  let response: Response;
  try {
    response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new MikaCliError("METADATA_REQUEST_FAILED", "Unable to reach the target URL.", {
      cause: error,
      details: {
        target,
      },
    });
  }

  if (!response.ok) {
    throw new MikaCliError("METADATA_REQUEST_FAILED", `Metadata request failed with ${response.status} ${response.statusText}.`, {
      details: {
        status: response.status,
        statusText: response.statusText,
        url: response.url || target,
      },
    });
  }

  return {
    finalUrl: response.url || target,
    status: response.status,
    statusText: response.statusText,
    html: await response.text(),
  };
}

function extractMetadata(html: string, finalUrl: string): {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  faviconUrl: string | null;
  htmlLang: string | null;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
} {
  const title = decodeHtml(matchTagContent(html, "title"));
  const htmlLang = extractHtmlLanguage(html);
  const metaTags = extractMetaTags(html);
  const linkTags = extractLinkTags(html);

  const canonicalUrl = resolveOptionalUrl(findCanonicalUrl(linkTags), finalUrl);
  const faviconUrl = resolveOptionalUrl(findFaviconUrl(linkTags), finalUrl);
  const description = firstNonEmpty([
    metaTags["description"],
    metaTags["og:description"],
    metaTags["twitter:description"],
  ]);

  const openGraph = Object.fromEntries(
    Object.entries(metaTags)
      .filter(([key]) => key.startsWith("og:"))
      .filter(([, value]) => value.length > 0),
  );

  const twitter = Object.fromEntries(
    Object.entries(metaTags)
      .filter(([key]) => key.startsWith("twitter:"))
      .filter(([, value]) => value.length > 0),
  );

  return {
    title: title || null,
    description: description || null,
    canonicalUrl,
    faviconUrl,
    htmlLang,
    openGraph,
    twitter,
  };
}

function matchTagContent(html: string, tagName: string): string {
  const match = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(html);
  return match?.[1]?.trim() ?? "";
}

function extractHtmlLanguage(html: string): string | null {
  const match = /<html[^>]*\blang=["']([^"']+)["']/i.exec(html);
  return match?.[1]?.trim() || null;
}

function extractMetaTags(html: string): Record<string, string> {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const entries: Record<string, string> = {};
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    const key = attrs.name || attrs.property;
    const content = attrs.content;
    if (!key || !content) {
      continue;
    }
    entries[key.trim().toLowerCase()] = decodeHtml(content.trim());
  }
  return entries;
}

function extractLinkTags(html: string): Array<Record<string, string>> {
  return (html.match(/<link\b[^>]*>/gi) ?? []).map((tag) => parseAttributes(tag));
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(regex)) {
    const key = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (key) {
      attributes[key] = value;
    }
  }
  return attributes;
}

function findCanonicalUrl(links: Array<Record<string, string>>): string | undefined {
  return links.find((entry) => (entry.rel ?? "").toLowerCase().split(/\s+/).includes("canonical"))?.href;
}

function findFaviconUrl(links: Array<Record<string, string>>): string | undefined {
  return links.find((entry) => (entry.rel ?? "").toLowerCase().includes("icon"))?.href;
}

function resolveOptionalUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function firstNonEmpty(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

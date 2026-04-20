import { MikaCliError } from "../../../errors.js";
import { normalizePublicHttpUrl } from "./url.js";

type PublicHtmlFetchResult = {
  target: string;
  finalUrl: string;
  status: number;
  statusText: string;
  html: string;
};

export type HtmlTagAttributes = Record<string, string>;

export async function fetchPublicHtmlDocument(input: {
  target: string;
  timeoutMs?: number;
  errorCode: string;
  errorLabel: string;
}): Promise<PublicHtmlFetchResult> {
  const target = normalizePublicHttpUrl(input.target);
  const timeoutMs = clampNumber(input.timeoutMs ?? 15000, 1000, 60000);

  let response: Response;
  try {
    response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new MikaCliError(input.errorCode, `Unable to reach the target URL for ${input.errorLabel}.`, {
      cause: error,
      details: { target },
    });
  }

  if (!response.ok) {
    throw new MikaCliError(input.errorCode, `${input.errorLabel} request failed with ${response.status} ${response.statusText}.`, {
      details: {
        status: response.status,
        statusText: response.statusText,
        url: response.url || target,
      },
    });
  }

  return {
    target,
    finalUrl: response.url || target,
    status: response.status,
    statusText: response.statusText,
    html: await response.text(),
  };
}

export function parseAttributes(tag: string): HtmlTagAttributes {
  const attributes: HtmlTagAttributes = {};
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

export function extractLinkTags(html: string): HtmlTagAttributes[] {
  return (html.match(/<link\b[^>]*>/giu) ?? []).map((tag) => parseAttributes(tag));
}

export function extractAnchorTags(html: string): Array<HtmlTagAttributes & { text?: string }> {
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu);
  return Array.from(matches, (match) => {
    const attrs = parseAttributes(match[1] ?? "");
    const text = decodeHtml(stripTags(match[2] ?? "")).replace(/\s+/gu, " ").trim();
    return {
      ...attrs,
      ...(text ? { text } : {}),
    };
  });
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&#x27;/giu, "'");
}

export function resolveOptionalHttpUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/gu, " ");
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

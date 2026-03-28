import { extractAnchorTags, fetchPublicHtmlDocument, resolveOptionalHttpUrl } from "../shared/html.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type PageLinksInput = {
  target: string;
  timeoutMs?: number;
  type?: "all" | "internal" | "external";
  limit?: number;
};

type PageLink = {
  url: string;
  text?: string;
  rel?: string;
  target?: string;
  kind: "internal" | "external";
};

export class PageLinksAdapter {
  readonly platform: Platform = "page-links" as Platform;
  readonly displayName = "Page Links";

  async inspect(input: PageLinksInput): Promise<AdapterActionResult> {
    const page = await fetchPublicHtmlDocument({
      target: input.target,
      timeoutMs: input.timeoutMs ?? 15000,
      errorCode: "PAGE_LINKS_REQUEST_FAILED",
      errorLabel: "page links",
    });

    const allLinks = extractPageLinks(page.html, page.finalUrl);
    const selectedType = normalizeType(input.type);
    const filtered = selectedType === "all" ? allLinks : allLinks.filter((link) => link.kind === selectedType);
    const limit = clampNumber(input.limit ?? 100, 1, 1000);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "page-links",
      message: `Loaded ${filtered.slice(0, limit).length} ${selectedType === "all" ? "" : `${selectedType} `}link${filtered.length === 1 ? "" : "s"} from ${page.finalUrl}.`,
      url: page.finalUrl,
      data: {
        target: page.target,
        finalUrl: page.finalUrl,
        status: page.status,
        statusText: page.statusText,
        type: selectedType,
        total: allLinks.length,
        internalCount: allLinks.filter((link) => link.kind === "internal").length,
        externalCount: allLinks.filter((link) => link.kind === "external").length,
        links: filtered.slice(0, limit),
      },
    };
  }
}

export const pageLinksAdapter = new PageLinksAdapter();

export function extractPageLinks(html: string, baseUrl: string): PageLink[] {
  const pageUrl = new URL(baseUrl);
  const seen = new Set<string>();
  const links: PageLink[] = [];

  for (const anchor of extractAnchorTags(html)) {
    const resolved = resolveOptionalHttpUrl(anchor.href, baseUrl);
    if (!resolved || seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    const url = new URL(resolved);
    links.push({
      url: url.toString(),
      ...(anchor.text ? { text: anchor.text } : {}),
      ...(anchor.rel ? { rel: anchor.rel } : {}),
      ...(anchor.target ? { target: anchor.target } : {}),
      kind: isInternalUrl(url, pageUrl) ? "internal" : "external",
    });
  }

  return links;
}

function normalizeType(value: string | undefined): "all" | "internal" | "external" {
  const normalized = value?.trim().toLowerCase() ?? "all";
  if (normalized === "all" || normalized === "internal" || normalized === "external") {
    return normalized;
  }

  throw new Error(`Invalid link type "${value}". Use all, internal, or external.`);
}

function isInternalUrl(candidate: URL, pageUrl: URL): boolean {
  return normalizeHost(candidate.hostname) === normalizeHost(pageUrl.hostname);
}

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./u, "").toLowerCase();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

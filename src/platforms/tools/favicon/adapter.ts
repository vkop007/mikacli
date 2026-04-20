import { MikaCliError } from "../../../errors.js";
import { extractLinkTags, fetchPublicHtmlDocument, resolveOptionalHttpUrl } from "../shared/html.js";
import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type FaviconInspectInput = {
  target: string;
  timeoutMs?: number;
};

type FaviconCandidate = {
  url: string;
  rel: string;
  sizes?: string;
  type?: string;
  source: "link" | "fallback";
  reachable?: boolean;
  status?: number;
  contentType?: string | null;
  contentLength?: number | null;
};

export class FaviconAdapter {
  readonly platform: Platform = "favicon" as Platform;
  readonly displayName = "Favicon";

  async inspect(input: FaviconInspectInput): Promise<AdapterActionResult> {
    const target = normalizePublicHttpUrl(input.target);
    const timeoutMs = input.timeoutMs ?? 15000;

    let page:
      | {
          target: string;
          finalUrl: string;
          status: number;
          statusText: string;
          html: string;
        }
      | undefined;

    try {
      page = await fetchPublicHtmlDocument({
        target,
        timeoutMs,
        errorCode: "FAVICON_REQUEST_FAILED",
        errorLabel: "favicon",
      });
    } catch (error) {
      if (!isFallbackableFaviconError(error)) {
        throw error;
      }
    }

    const candidates = page
      ? await buildFaviconCandidates(page.html, page.finalUrl, timeoutMs)
      : await buildDirectFaviconFallback(target, timeoutMs);
    const primary = candidates.find((candidate) => candidate.reachable) ?? candidates[0];

    if (!primary) {
      throw new MikaCliError("FAVICON_NOT_FOUND", "No favicon candidates were found on the page.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "favicon",
      message: `Loaded ${candidates.length} favicon candidate${candidates.length === 1 ? "" : "s"} from ${(page?.finalUrl ?? target)}.`,
      url: primary.url,
      data: {
        target: page?.target ?? target,
        finalUrl: page?.finalUrl ?? target,
        status: page?.status,
        statusText: page?.statusText,
        faviconUrl: primary.url,
        sourceMode: page ? "page" : "fallback",
        candidates,
      },
    };
  }
}

export const faviconAdapter = new FaviconAdapter();

export async function buildFaviconCandidates(
  html: string,
  baseUrl: string,
  timeoutMs: number,
  inspectCandidates = true,
): Promise<FaviconCandidate[]> {
  const seen = new Set<string>();
  const candidates: FaviconCandidate[] = [];

  for (const link of extractLinkTags(html)) {
    const rel = (link.rel ?? "").toLowerCase();
    if (!rel.includes("icon")) {
      continue;
    }

    const resolved = resolveOptionalHttpUrl(link.href, baseUrl);
    if (!resolved || seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    candidates.push({
      url: resolved,
      rel,
      sizes: link.sizes,
      type: link.type,
      source: "link",
    });
  }

  const fallback = new URL("/favicon.ico", baseUrl).toString();
  if (!seen.has(fallback)) {
    seen.add(fallback);
    candidates.push({
      url: fallback,
      rel: "icon",
      source: "fallback",
    });
  }

  if (!inspectCandidates) {
    return candidates;
  }

  return Promise.all(candidates.map((candidate) => inspectCandidate(candidate, timeoutMs)));
}

async function buildDirectFaviconFallback(target: string, timeoutMs: number): Promise<FaviconCandidate[]> {
  const url = new URL(target);
  const fallback = `${url.origin}/favicon.ico`;
  return [await inspectCandidate({ url: fallback, rel: "icon", source: "fallback" }, timeoutMs)];
}

async function inspectCandidate(candidate: FaviconCandidate, timeoutMs: number): Promise<FaviconCandidate> {
  const response = await tryHeadThenGet(candidate.url, timeoutMs);
  if (!response) {
    return {
      ...candidate,
      reachable: false,
    };
  }

  const contentLengthRaw = response.headers.get("content-length");
  const contentLength = contentLengthRaw ? Number.parseInt(contentLengthRaw, 10) : null;

  return {
    ...candidate,
    reachable: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
    contentLength: Number.isFinite(contentLength) ? contentLength : null,
  };
}

async function tryHeadThenGet(url: string, timeoutMs: number): Promise<Response | null> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: "image/*,*/*;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });

      if (method === "HEAD" && shouldRetryWithGet(response.status)) {
        continue;
      }

      return response;
    } catch {
      if (method === "GET") {
        return null;
      }
    }
  }

  return null;
}

function shouldRetryWithGet(status: number): boolean {
  return status === 400 || status === 403 || status === 405 || status === 406 || status === 500 || status === 501;
}

function isFallbackableFaviconError(error: unknown): boolean {
  return error instanceof MikaCliError && error.code === "FAVICON_REQUEST_FAILED";
}

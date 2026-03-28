import { AutoCliError } from "../../../errors.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import { htmlToText, normalizeWhitespace } from "../../data/shared/text.js";

import type { CookieJar } from "tough-cookie";

const ATLASSIAN_HOST_IGNORE = new Set(["id.atlassian.com", "admin.atlassian.com", "api.atlassian.com"]);

export function normalizeConfluenceSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new AutoCliError("CONFLUENCE_SITE_REQUIRED", "Provide a Confluence site URL like https://your-workspace.atlassian.net/wiki.");
  }

  const withProtocol = /^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch (error) {
    throw new AutoCliError("CONFLUENCE_SITE_INVALID", `Invalid Confluence site URL "${input}".`, {
      cause: error,
      details: { input },
    });
  }

  const path = url.pathname.replace(/\/+$/u, "");
  const normalizedPath = path.endsWith("/wiki") ? path : `${path}/wiki`;
  return `${url.origin}${normalizedPath.replace(/\/{2,}/gu, "/")}`;
}

export async function inferConfluenceSiteUrlFromJar(jar: CookieJar): Promise<string | undefined> {
  const serialized = serializeCookieJar(jar);
  const domains = Array.isArray(serialized.cookies)
    ? serialized.cookies
        .map((cookie) => (typeof cookie.domain === "string" ? normalizeDomain(cookie.domain) : undefined))
        .filter((value): value is string => Boolean(value))
    : [];

  const preferred = domains.find((domain) => domain.endsWith(".atlassian.net"));
  if (preferred) {
    return `https://${preferred}/wiki`;
  }

  const fallback = domains.find((domain) => domain.includes(".") && !ATLASSIAN_HOST_IGNORE.has(domain));
  return fallback ? `https://${fallback}/wiki` : undefined;
}

export function getStoredConfluenceSiteUrl(metadata?: Record<string, unknown>): string | undefined {
  const candidate = metadata?.siteUrl;
  return typeof candidate === "string" && candidate.trim().length > 0 ? normalizeConfluenceSiteUrl(candidate) : undefined;
}

export function normalizeConfluenceSpaceTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("CONFLUENCE_SPACE_TARGET_INVALID", "Confluence space target cannot be empty.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const fromSpaces = url.pathname.match(/\/spaces\/([^/]+)/iu)?.[1];
    const fromDisplay = url.pathname.match(/\/display\/([^/]+)/iu)?.[1];
    const resolved = fromSpaces ?? fromDisplay;
    if (!resolved) {
      throw new AutoCliError("CONFLUENCE_SPACE_TARGET_INVALID", `Could not resolve a Confluence space key from "${target}".`);
    }
    return decodeURIComponent(resolved).toUpperCase();
  }

  return trimmed.toUpperCase();
}

export function normalizeConfluencePageTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new AutoCliError("CONFLUENCE_PAGE_TARGET_INVALID", "Confluence page target cannot be empty.");
  }

  if (/^\d+$/u.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const pageId =
      url.searchParams.get("pageId") ??
      url.pathname.match(/\/pages\/(\d+)/iu)?.[1];

    if (!pageId) {
      throw new AutoCliError("CONFLUENCE_PAGE_TARGET_INVALID", `Could not resolve a Confluence page ID from "${target}".`);
    }

    return pageId;
  }

  throw new AutoCliError("CONFLUENCE_PAGE_TARGET_INVALID", `Invalid Confluence page target "${target}". Expected a numeric page ID or page URL.`);
}

export function buildConfluencePageUrl(siteUrl: string, pageId: string): string {
  return `${normalizeConfluenceSiteUrl(siteUrl)}/pages/viewpage.action?pageId=${encodeURIComponent(pageId)}`;
}

export function buildConfluenceSpaceUrl(siteUrl: string, spaceKey: string): string {
  return `${normalizeConfluenceSiteUrl(siteUrl)}/spaces/${encodeURIComponent(normalizeConfluenceSpaceTarget(spaceKey))}`;
}

export function summarizeConfluenceStorageHtml(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const text = normalizeWhitespace(htmlToText(value));
  return text.length > 0 ? text : undefined;
}

export function confluenceStorageFromPlainText(input?: string): string | undefined {
  const text = input?.trim();
  if (!text) {
    return undefined;
  }

  const paragraphs = text
    .split(/\n{2,}/u)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/gu, "<br />")}</p>`);

  return paragraphs.join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^\./u, "").trim().toLowerCase();
}

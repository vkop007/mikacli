import { XMLParser } from "fast-xml-parser";

import { MikaCliError } from "../../../errors.js";
import { decodeHtml, extractLinkTags, fetchPublicHtmlDocument, resolveOptionalHttpUrl } from "../shared/html.js";
import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type OEmbedInput = {
  target: string;
  format?: "auto" | "json" | "xml";
  maxWidth?: number;
  maxHeight?: number;
  discoverOnly?: boolean;
  timeoutMs?: number;
};

type OEmbedEndpoint = {
  url: string;
  format: "json" | "xml";
  title?: string;
};

type OEmbedPayload = {
  type?: string;
  version?: string;
  title?: string;
  authorName?: string;
  authorUrl?: string;
  providerName?: string;
  providerUrl?: string;
  cacheAge?: number;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  width?: number;
  height?: number;
  html?: string;
  raw: Record<string, unknown>;
};

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: true,
  trimValues: true,
});

export class OEmbedAdapter {
  readonly platform: Platform = "oembed" as Platform;
  readonly displayName = "oEmbed";

  async inspect(input: OEmbedInput): Promise<AdapterActionResult> {
    const target = normalizePublicHttpUrl(input.target);
    const timeoutMs = clampNumber(input.timeoutMs ?? 15000, 1000, 60000);
    const format = normalizeFormat(input.format);
    const maxWidth = clampOptionalDimension(input.maxWidth);
    const maxHeight = clampOptionalDimension(input.maxHeight);
    const discoverOnly = Boolean(input.discoverOnly);

    let page:
      | {
          finalUrl: string;
          status: number;
          statusText: string;
          html: string;
        }
      | undefined;
    let discoveredEndpoints: OEmbedEndpoint[] = [];
    let discoveryError: MikaCliError | undefined;

    try {
      const document = await fetchPublicHtmlDocument({
        target,
        timeoutMs,
        errorCode: "OEMBED_REQUEST_FAILED",
        errorLabel: "oEmbed discovery",
      });
      page = {
        finalUrl: document.finalUrl,
        status: document.status,
        statusText: document.statusText,
        html: document.html,
      };
      discoveredEndpoints = extractOEmbedEndpoints(document.html, document.finalUrl);
    } catch (error) {
      if (error instanceof MikaCliError) {
        discoveryError = error;
      } else {
        throw error;
      }
    }

    const resolvedTarget = page?.finalUrl ?? target;

    if (discoveredEndpoints.length > 0) {
      try {
        const discovered = await requestDiscoveredOEmbed({
          target: resolvedTarget,
          endpoints: discoveredEndpoints,
          format,
          maxWidth,
          maxHeight,
          timeoutMs,
        });

        return this.buildResult({
          target,
          finalUrl: resolvedTarget,
          page,
          discoveredEndpoints,
          sourceMode: "discovery",
          endpointUrl: discovered.endpointUrl,
          format: discovered.format,
          payload: discovered.payload,
        });
      } catch (error) {
        if (discoverOnly) {
          throw error;
        }

        if (error instanceof MikaCliError) {
          discoveryError = error;
        } else {
          throw error;
        }
      }
    }

    if (discoverOnly) {
      throw new MikaCliError("OEMBED_DISCOVERY_NOT_FOUND", "No oEmbed discovery endpoint was found on the page.", {
        details: {
          target,
          finalUrl: resolvedTarget,
          discoveryError: discoveryError?.message,
        },
      });
    }

    const fallback = await requestNoEmbed({
      target: resolvedTarget,
      maxWidth,
      maxHeight,
      timeoutMs,
    });

    return this.buildResult({
      target,
      finalUrl: resolvedTarget,
      page,
      discoveredEndpoints,
      sourceMode: "fallback",
      endpointUrl: fallback.endpointUrl,
      format: "json",
      payload: fallback.payload,
    });
  }

  private buildResult(input: {
    target: string;
    finalUrl: string;
    page?: { status: number; statusText: string };
    discoveredEndpoints: OEmbedEndpoint[];
    sourceMode: "discovery" | "fallback";
    endpointUrl: string;
    format: "json" | "xml";
    payload: OEmbedPayload;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "oembed",
      message: `Loaded oEmbed metadata for ${input.finalUrl} via ${input.sourceMode === "discovery" ? "page discovery" : "public fallback"}.`,
      url: input.finalUrl,
      data: {
        target: input.target,
        finalUrl: input.finalUrl,
        ...(input.page ? { status: input.page.status, statusText: input.page.statusText } : {}),
        sourceMode: input.sourceMode,
        endpointUrl: input.endpointUrl,
        format: input.format,
        discoveredEndpoints: input.discoveredEndpoints,
        ...input.payload,
      },
    };
  }
}

export const oEmbedAdapter = new OEmbedAdapter();

export function extractOEmbedEndpoints(html: string, baseUrl: string): OEmbedEndpoint[] {
  const seen = new Set<string>();
  const endpoints: OEmbedEndpoint[] = [];

  for (const link of extractLinkTags(html)) {
    const type = (link.type ?? "").toLowerCase();
    const rel = (link.rel ?? "").toLowerCase();
    if (!rel.includes("alternate")) {
      continue;
    }

    const format =
      type === "application/json+oembed" ? "json"
      : type === "text/xml+oembed" || type === "application/xml+oembed" ? "xml"
      : undefined;
    if (!format) {
      continue;
    }

    const resolved = resolveOptionalHttpUrl(typeof link.href === "string" ? decodeHtml(link.href) : undefined, baseUrl);
    if (!resolved || seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    endpoints.push({
      url: resolved,
      format,
      title: typeof link.title === "string" && link.title.trim().length > 0 ? link.title.trim() : undefined,
    });
  }

  return endpoints;
}

async function requestDiscoveredOEmbed(input: {
  target: string;
  endpoints: OEmbedEndpoint[];
  format: "auto" | "json" | "xml";
  maxWidth?: number;
  maxHeight?: number;
  timeoutMs: number;
}): Promise<{
  endpointUrl: string;
  format: "json" | "xml";
  payload: OEmbedPayload;
}> {
  const orderedEndpoints = prioritizeEndpoints(input.endpoints, input.format);
  let lastError: unknown;

  for (const endpoint of orderedEndpoints) {
    try {
      const endpointUrl = buildOEmbedEndpointUrl(endpoint.url, input.target, endpoint.format, input.maxWidth, input.maxHeight);
      const response = await fetch(endpointUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(input.timeoutMs),
        headers: {
          accept: endpoint.format === "xml" ? "text/xml,application/xml;q=0.9,*/*;q=0.8" : "application/json,*/*;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });

      if (!response.ok) {
        throw new MikaCliError("OEMBED_REQUEST_FAILED", `oEmbed endpoint failed with ${response.status} ${response.statusText}.`, {
          details: {
            endpointUrl,
            status: response.status,
            statusText: response.statusText,
          },
        });
      }

      const text = await response.text();
      const payload = endpoint.format === "xml" ? parseXmlOEmbed(text) : parseJsonOEmbed(text);
      return {
        endpointUrl,
        format: endpoint.format,
        payload,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw normalizeOEmbedError(lastError, "Unable to load oEmbed metadata from discovered endpoints.");
}

async function requestNoEmbed(input: {
  target: string;
  maxWidth?: number;
  maxHeight?: number;
  timeoutMs: number;
}): Promise<{
  endpointUrl: string;
  payload: OEmbedPayload;
}> {
  const endpoint = new URL("https://noembed.com/embed");
  endpoint.searchParams.set("url", input.target);
  if (typeof input.maxWidth === "number") {
    endpoint.searchParams.set("maxwidth", String(input.maxWidth));
  }
  if (typeof input.maxHeight === "number") {
    endpoint.searchParams.set("maxheight", String(input.maxHeight));
  }

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(input.timeoutMs),
      headers: {
        accept: "application/json,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new MikaCliError("OEMBED_REQUEST_FAILED", "Unable to reach the public oEmbed fallback service.", {
      cause: error,
      details: {
        endpointUrl: endpoint.toString(),
      },
    });
  }

  const body = await response.text();
  if (!response.ok) {
    throw new MikaCliError("OEMBED_NOT_SUPPORTED", "The public fallback service could not resolve oEmbed metadata for this URL.", {
      details: {
        endpointUrl: endpoint.toString(),
        status: response.status,
        statusText: response.statusText,
        body: body.slice(0, 200),
      },
    });
  }

  const payload = parseJsonOEmbed(body);
  return {
    endpointUrl: endpoint.toString(),
    payload,
  };
}

function prioritizeEndpoints(endpoints: readonly OEmbedEndpoint[], format: "auto" | "json" | "xml"): OEmbedEndpoint[] {
  if (format === "auto") {
    return [...endpoints].sort((left, right) => {
      if (left.format === right.format) {
        return 0;
      }
      return left.format === "json" ? -1 : 1;
    });
  }

  return [...endpoints].sort((left, right) => {
    const leftScore = left.format === format ? 0 : 1;
    const rightScore = right.format === format ? 0 : 1;
    return leftScore - rightScore;
  });
}

function buildOEmbedEndpointUrl(
  endpoint: string,
  target: string,
  format: "json" | "xml",
  maxWidth?: number,
  maxHeight?: number,
): string {
  const url = new URL(endpoint);
  if (!url.searchParams.has("url")) {
    url.searchParams.set("url", target);
  }
  if (!url.searchParams.has("format")) {
    url.searchParams.set("format", format);
  }
  if (typeof maxWidth === "number" && !url.searchParams.has("maxwidth")) {
    url.searchParams.set("maxwidth", String(maxWidth));
  }
  if (typeof maxHeight === "number" && !url.searchParams.has("maxheight")) {
    url.searchParams.set("maxheight", String(maxHeight));
  }
  return url.toString();
}

function parseJsonOEmbed(text: string): OEmbedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new MikaCliError("OEMBED_RESPONSE_INVALID", "The oEmbed endpoint returned invalid JSON.", {
      cause: error,
      details: {
        preview: text.slice(0, 200),
      },
    });
  }

  const record = asRecord(parsed);
  return normalizeOEmbedRecord(record);
}

function parseXmlOEmbed(text: string): OEmbedPayload {
  let parsed: unknown;
  try {
    parsed = XML_PARSER.parse(text);
  } catch (error) {
    throw new MikaCliError("OEMBED_RESPONSE_INVALID", "The oEmbed endpoint returned invalid XML.", {
      cause: error,
      details: {
        preview: text.slice(0, 200),
      },
    });
  }

  const record = asRecord(parsed);
  const root =
    asRecord(record.oembed).type ? asRecord(record.oembed)
    : Object.values(record).find((value) => value && typeof value === "object" && !Array.isArray(value));

  return normalizeOEmbedRecord(asRecord(root));
}

function normalizeOEmbedRecord(record: Record<string, unknown>): OEmbedPayload {
  return {
    type: asString(record.type),
    version: asString(record.version),
    title: asString(record.title),
    authorName: asString(record.author_name),
    authorUrl: asString(record.author_url),
    providerName: asString(record.provider_name),
    providerUrl: asString(record.provider_url),
    cacheAge: asInteger(record.cache_age),
    thumbnailUrl: asString(record.thumbnail_url),
    thumbnailWidth: asInteger(record.thumbnail_width),
    thumbnailHeight: asInteger(record.thumbnail_height),
    width: asInteger(record.width),
    height: asInteger(record.height),
    html: asString(record.html),
    raw: record,
  };
}

function normalizeOEmbedError(error: unknown, fallbackMessage: string): MikaCliError {
  if (error instanceof MikaCliError) {
    return error;
  }

  return new MikaCliError("OEMBED_REQUEST_FAILED", fallbackMessage, {
    cause: error,
  });
}

function normalizeFormat(value: string | undefined): "auto" | "json" | "xml" {
  const normalized = value?.trim().toLowerCase() ?? "auto";
  if (normalized === "auto" || normalized === "json" || normalized === "xml") {
    return normalized;
  }

  throw new MikaCliError("OEMBED_FORMAT_INVALID", `Unsupported oEmbed format "${value}". Use auto, json, or xml.`);
}

function clampOptionalDimension(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return clampNumber(Math.trunc(value), 1, 10000);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

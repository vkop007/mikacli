import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type UptimeCheckInput = {
  target: string;
  method?: string;
  timeoutMs?: number;
};

type UptimeHttpMethod = "HEAD" | "GET";

export class UptimeAdapter {
  readonly platform: Platform = "uptime" as Platform;
  readonly displayName = "Uptime";

  async uptime(input: UptimeCheckInput): Promise<AdapterActionResult> {
    const target = normalizePublicHttpUrl(input.target);
    const timeoutMs = clampNumber(input.timeoutMs ?? 10000, 1000, 60000);
    const preferredMethod = normalizeMethod(input.method);

    const result = await this.probe(target, preferredMethod, timeoutMs);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "uptime",
      message: `Checked ${result.finalUrl} in ${result.latencyMs}ms (${result.status}).`,
      url: result.finalUrl,
      data: {
        target,
        finalUrl: result.finalUrl,
        status: result.status,
        statusText: result.statusText,
        ok: result.ok,
        healthy: result.healthy,
        reachable: true,
        latencyMs: result.latencyMs,
        method: result.method,
        redirected: result.redirected,
        contentType: result.contentType,
        contentLength: result.contentLength,
      },
    };
  }

  private async probe(target: string, preferredMethod: UptimeHttpMethod, timeoutMs: number) {
    const firstAttempt = await requestProbe(target, preferredMethod, timeoutMs);

    if (preferredMethod === "HEAD" && shouldRetryWithGet(firstAttempt.status)) {
      return requestProbe(target, "GET", timeoutMs);
    }

    return firstAttempt;
  }
}

export const uptimeAdapter = new UptimeAdapter();

async function requestProbe(target: string, method: UptimeHttpMethod, timeoutMs: number) {
  const startedAt = performance.now();
  const response = await fetch(target, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept: "*/*",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
    },
  });
  const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));

  return {
    finalUrl: response.url || target,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    healthy: response.status >= 200 && response.status < 400,
    latencyMs,
    method,
    redirected: response.redirected || response.url !== target,
    contentType: normalizeOptionalString(response.headers.get("content-type")),
    contentLength: parseHeaderNumber(response.headers.get("content-length")),
  };
}

function normalizeMethod(value: string | undefined): UptimeHttpMethod {
  const normalized = value?.trim().toUpperCase() ?? "HEAD";
  if (normalized === "HEAD" || normalized === "GET") {
    return normalized;
  }

  return "HEAD";
}

function shouldRetryWithGet(status: number): boolean {
  return status === 400 || status === 403 || status === 405 || status === 406 || status === 500 || status === 501;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseHeaderNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalString(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

import { MikaCliError } from "../../../errors.js";
import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type HeadersInput = {
  target: string;
  method?: string;
  timeoutMs?: number;
};

type HeadersMethod = "HEAD" | "GET";

export class HeadersAdapter {
  readonly platform: Platform = "headers" as Platform;
  readonly displayName = "Headers";

  async inspect(input: HeadersInput): Promise<AdapterActionResult> {
    const target = normalizePublicHttpUrl(input.target);
    const timeoutMs = clampNumber(input.timeoutMs ?? 10000, 1000, 60000);
    const method = normalizeMethod(input.method);
    const response = await requestHeaders(target, method, timeoutMs);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "headers",
      message: `Loaded ${Object.keys(response.headers).length} header${Object.keys(response.headers).length === 1 ? "" : "s"} from ${response.finalUrl}.`,
      url: response.finalUrl,
      data: {
        target,
        finalUrl: response.finalUrl,
        status: response.status,
        statusText: response.statusText,
        method: response.method,
        redirected: response.redirected,
        headers: response.headers,
      },
    };
  }
}

export const headersAdapter = new HeadersAdapter();

async function requestHeaders(target: string, method: HeadersMethod, timeoutMs: number): Promise<{
  finalUrl: string;
  status: number;
  statusText: string;
  method: HeadersMethod;
  redirected: boolean;
  headers: Record<string, string>;
}> {
  let response: Response;
  try {
    response = await fetch(target, {
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
  } catch (error) {
    throw new MikaCliError("HEADERS_REQUEST_FAILED", "Unable to reach the target URL.", {
      cause: error,
      details: {
        target,
        method,
      },
    });
  }

  if (method === "HEAD" && shouldRetryWithGet(response.status)) {
    return requestHeaders(target, "GET", timeoutMs);
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of response.headers.entries()) {
    headers[key] = value;
  }

  return {
    finalUrl: response.url || target,
    status: response.status,
    statusText: response.statusText,
    method,
    redirected: response.redirected || response.url !== target,
    headers,
  };
}

function normalizeMethod(value: string | undefined): HeadersMethod {
  const normalized = value?.trim().toUpperCase() ?? "HEAD";
  if (normalized === "HEAD" || normalized === "GET") {
    return normalized;
  }

  throw new MikaCliError("HEADERS_METHOD_INVALID", `Unsupported headers method "${value}". Use HEAD or GET.`);
}

function shouldRetryWithGet(status: number): boolean {
  return status === 400 || status === 403 || status === 405 || status === 406 || status === 500 || status === 501;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

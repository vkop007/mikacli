import { MikaCliError } from "../../../errors.js";
import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type RedirectInput = {
  target: string;
  method?: string;
  timeoutMs?: number;
  maxHops?: number;
};

type RedirectMethod = "HEAD" | "GET";

export class RedirectAdapter {
  readonly platform: Platform = "redirect" as Platform;
  readonly displayName = "Redirect";

  async trace(input: RedirectInput): Promise<AdapterActionResult> {
    const target = normalizePublicHttpUrl(input.target);
    const method = normalizeMethod(input.method);
    const timeoutMs = clampNumber(input.timeoutMs ?? 15000, 1000, 60000);
    const maxHops = clampNumber(Math.round(input.maxHops ?? 10), 1, 25);
    const chain = await traceRedirects(target, method, timeoutMs, maxHops);
    const finalStep = chain[chain.length - 1]!;
    const finalUrl = typeof finalStep.url === "string" ? finalStep.url : target;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "redirect",
      message: chain.length > 1 ? `Followed ${chain.length - 1} redirect hop${chain.length === 2 ? "" : "s"}.` : "No redirects detected.",
      url: finalUrl,
      data: {
        target,
        finalUrl,
        method,
        hopCount: Math.max(0, chain.length - 1),
        chain,
        redirected: chain.length > 1,
        status: typeof finalStep.status === "number" ? finalStep.status : null,
        statusText: typeof finalStep.statusText === "string" ? finalStep.statusText : null,
      },
    };
  }
}

export const redirectAdapter = new RedirectAdapter();

async function traceRedirects(target: string, method: RedirectMethod, timeoutMs: number, maxHops: number): Promise<Array<Record<string, unknown>>> {
  const chain: Array<Record<string, unknown>> = [];
  let currentUrl = target;
  let currentMethod: RedirectMethod = method;

  for (let hop = 0; hop <= maxHops; hop += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: currentMethod,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: "*/*",
          "cache-control": "no-cache",
          pragma: "no-cache",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("REDIRECT_REQUEST_FAILED", "Unable to reach the target URL.", {
        cause: error,
        details: {
          url: currentUrl,
          hop,
        },
      });
    }

    const locationHeader = response.headers.get("location");
    const nextUrl = locationHeader ? new URL(locationHeader, currentUrl).toString() : null;
    chain.push({
      hop,
      url: currentUrl,
      status: response.status,
      statusText: response.statusText,
      location: nextUrl,
      method: currentMethod,
    });

    if (!nextUrl || !isRedirectStatus(response.status)) {
      return chain;
    }

    currentUrl = nextUrl;
    currentMethod = response.status === 303 ? "GET" : currentMethod;
  }

  throw new MikaCliError("REDIRECT_TOO_MANY_HOPS", `Redirect chain exceeded ${maxHops} hops.`, {
    details: {
      target,
      maxHops,
      chain,
    },
  });
}

function normalizeMethod(value: string | undefined): RedirectMethod {
  const normalized = value?.trim().toUpperCase() ?? "HEAD";
  if (normalized === "HEAD" || normalized === "GET") {
    return normalized;
  }

  throw new MikaCliError("REDIRECT_METHOD_INVALID", `Unsupported redirect method "${value}". Use HEAD or GET.`);
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

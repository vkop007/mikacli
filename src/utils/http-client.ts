import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";

import { MikaCliError } from "../errors.js";

export interface RequestOptions extends RequestInit {
  responseType?: "json" | "text" | "arrayBuffer";
  expectedStatus?: number | number[];
  retries?: number;
  retryDelayMs?: number;
  retryOn?: number[];
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_RETRY_ON = [429, 500, 502, 503, 504];

export class SessionHttpClient {
  readonly jar: CookieJar;
  private readonly cookieFetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

  constructor(
    jar?: CookieJar,
    private readonly defaultHeaders: Record<string, string> = {},
    fetchImpl: typeof fetch = fetch,
    private readonly sleepImpl: (delayMs: number) => Promise<void> = sleep,
  ) {
    this.jar = jar ?? new CookieJar();
    // Social platforms sometimes return cross-host Set-Cookie headers during
    // otherwise successful requests. We keep the request and ignore the bad
    // cookie instead of failing the whole command.
    this.cookieFetch = makeFetchCookie(fetchImpl, this.jar, true);
  }

  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    const result = await this.requestWithResponse<T>(url, options);
    return result.data;
  }

  async requestWithResponse<T = unknown>(
    url: string,
    options: RequestOptions = {},
  ): Promise<{ data: T; response: Response }> {
    const response = await this.executeRequest(url, options);
    const data = await this.parseResponse<T>(url, response, options.responseType ?? "json");
    return { data, response };
  }

  private async executeRequest(url: string, options: RequestOptions): Promise<Response> {
    const {
      responseType: _responseType,
      expectedStatus,
      retries,
      retryDelayMs,
      retryOn,
      ...requestInit
    } = options;

    const headers = new Headers(this.defaultHeaders);
    const incomingHeaders = new Headers(requestInit.headers);

    incomingHeaders.forEach((value, key) => headers.set(key, value));

    const expected = normalizeExpectedStatus(expectedStatus);
    const retryPolicy = normalizeRetryPolicy({
      retries,
      retryDelayMs,
      retryOn,
    });

    for (let attempt = 0; ; attempt += 1) {
      const response = await this.cookieFetch(url, {
        ...requestInit,
        headers,
      });

      if (expected.length > 0 && expected.includes(response.status)) {
        return response;
      }

      if (expected.length === 0 && response.ok) {
        return response;
      }

      if (!shouldRetryRequest(response, requestInit.body, expected, retryPolicy, attempt)) {
        throw await createHttpError(url, response, {
          attempts: attempt + 1,
          retriesRemaining: Math.max(0, retryPolicy.retries - attempt),
        });
      }

      await this.sleepImpl(resolveRetryDelayMs(response.headers, retryPolicy.retryDelayMs, attempt));
    }
  }

  private async parseResponse<T>(
    url: string,
    response: Response,
    responseType: NonNullable<RequestOptions["responseType"]>,
  ): Promise<T> {
    switch (responseType) {
      case "text":
        return (await response.text()) as T;
      case "arrayBuffer":
        return (await response.arrayBuffer()) as T;
      default: {
        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        try {
          return JSON.parse(text) as T;
        } catch (error) {
          throw new MikaCliError("INVALID_JSON_RESPONSE", "Received a non-JSON response from the platform.", {
            cause: error,
            details: { url, preview: text.slice(0, 200) },
          });
        }
      }
    }
  }

  async getCookieValue(name: string, url: string): Promise<string | undefined> {
    const cookies = await this.jar.getCookies(url);
    return cookies.find((cookie) => cookie.key === name)?.value;
  }
}

interface RetryPolicy {
  retries: number;
  retryDelayMs: number;
  retryOn: number[];
}

function normalizeExpectedStatus(expected?: number | number[]): number[] {
  if (typeof expected === "number") {
    return [expected];
  }

  return expected ?? [];
}

function normalizeRetryPolicy(input: Pick<RequestOptions, "retries" | "retryDelayMs" | "retryOn">): RetryPolicy {
  return {
    retries: normalizeNonNegativeInteger(input.retries, DEFAULT_RETRIES),
    retryDelayMs: normalizeNonNegativeInteger(input.retryDelayMs, DEFAULT_RETRY_DELAY_MS),
    retryOn: normalizeRetryStatuses(input.retryOn),
  };
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeRetryStatuses(retryOn?: number[]): number[] {
  const source = retryOn ?? DEFAULT_RETRY_ON;
  return Array.from(
    new Set(
      source
        .filter((status) => Number.isInteger(status))
        .map((status) => Math.trunc(status))
        .filter((status) => status >= 100 && status <= 599),
    ),
  );
}

function shouldRetryRequest(
  response: Response,
  body: BodyInit | null | undefined,
  expected: number[],
  retryPolicy: RetryPolicy,
  attempt: number,
): boolean {
  if (attempt >= retryPolicy.retries) {
    return false;
  }

  if (expected.includes(response.status)) {
    return false;
  }

  if (!retryPolicy.retryOn.includes(response.status)) {
    return false;
  }

  return canReplayRequestBody(body);
}

function canReplayRequestBody(body: BodyInit | null | undefined): boolean {
  if (body == null) {
    return true;
  }

  if (typeof body === "object") {
    if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
      return false;
    }

    if (Symbol.asyncIterator in body) {
      return false;
    }
  }

  return true;
}

function resolveRetryDelayMs(headers: Headers, retryDelayMs: number, attempt: number): number {
  const backoffDelayMs = retryDelayMs * 2 ** attempt;
  const retryAfterDelayMs = parseRetryAfterMs(headers);
  return retryAfterDelayMs == null ? backoffDelayMs : Math.max(backoffDelayMs, retryAfterDelayMs);
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, retryAt - Date.now());
}

async function createHttpError(
  url: string,
  response: Response,
  extraDetails: Record<string, unknown> = {},
): Promise<MikaCliError> {
  const body = await response.text().catch(() => "");
  return new MikaCliError("HTTP_REQUEST_FAILED", `Request failed with ${response.status} ${response.statusText}`, {
    details: {
      url,
      status: response.status,
      statusText: response.statusText,
      body: body.slice(0, 400),
      ...extraDetails,
    },
  });
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

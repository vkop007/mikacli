import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";

import { AutoCliError } from "../errors.js";

export interface RequestOptions extends RequestInit {
  responseType?: "json" | "text" | "arrayBuffer";
  expectedStatus?: number | number[];
}

export class SessionHttpClient {
  readonly jar: CookieJar;
  private readonly cookieFetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

  constructor(
    jar?: CookieJar,
    private readonly defaultHeaders: Record<string, string> = {},
  ) {
    this.jar = jar ?? new CookieJar();
    this.cookieFetch = makeFetchCookie(fetch, this.jar, false);
  }

  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(this.defaultHeaders);
    const incomingHeaders = new Headers(options.headers);

    incomingHeaders.forEach((value, key) => headers.set(key, value));

    const response = await this.cookieFetch(url, {
      ...options,
      headers,
    });

    const expected = normalizeExpectedStatus(options.expectedStatus);
    if (expected.length > 0 && !expected.includes(response.status)) {
      throw await createHttpError(url, response);
    }

    if (!response.ok && expected.length === 0) {
      throw await createHttpError(url, response);
    }

    switch (options.responseType ?? "json") {
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
          throw new AutoCliError("INVALID_JSON_RESPONSE", "Received a non-JSON response from the platform.", {
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

function normalizeExpectedStatus(expected?: number | number[]): number[] {
  if (typeof expected === "number") {
    return [expected];
  }

  return expected ?? [];
}

async function createHttpError(url: string, response: Response): Promise<AutoCliError> {
  const body = await response.text().catch(() => "");
  return new AutoCliError("HTTP_REQUEST_FAILED", `Request failed with ${response.status} ${response.statusText}`, {
    details: {
      url,
      status: response.status,
      statusText: response.statusText,
      body: body.slice(0, 400),
    },
  });
}

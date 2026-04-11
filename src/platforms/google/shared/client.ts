import { AutoCliError } from "../../../errors.js";

type QueryValue = string | number | boolean | undefined;
type JsonLikeBody = Record<string, unknown> | unknown[];
type GoogleRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonLikeBody | Buffer | ArrayBuffer | ArrayBufferView | null;
};

const USER_AGENT = "AutoCLI/0.1 (+https://github.com/vkop007/autocli)";

export class GoogleApiClient {
  constructor(
    private readonly options: {
      accessToken: string;
      baseUrl: string;
      errorCode: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async json<T>(pathOrUrl: string, init: GoogleRequestInit = {}, query?: Record<string, QueryValue>): Promise<T> {
    const response = await this.request(pathOrUrl, init, query);
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new AutoCliError(this.options.errorCode, "Google returned an unreadable JSON response.", {
        cause: error,
        details: {
          pathOrUrl,
          preview: text.slice(0, 400),
        },
      });
    }
  }

  async text(pathOrUrl: string, init: GoogleRequestInit = {}, query?: Record<string, QueryValue>): Promise<string> {
    const response = await this.request(pathOrUrl, init, query);
    return response.text();
  }

  async buffer(pathOrUrl: string, init: GoogleRequestInit = {}, query?: Record<string, QueryValue>): Promise<Buffer> {
    const response = await this.request(pathOrUrl, init, query);
    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  }

  async request(pathOrUrl: string, init: GoogleRequestInit = {}, query?: Record<string, QueryValue>): Promise<Response> {
    const url = buildUrl(this.options.baseUrl, pathOrUrl, query);
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.options.accessToken}`);
    headers.set("user-agent", USER_AGENT);
    headers.set("accept", headers.get("accept") ?? "application/json");

    const normalizedBody = normalizeBody(init.body, headers);
    const response = await this.fetchImpl()(url, {
      ...init,
      headers,
      body: normalizedBody,
    });

    if (!response.ok) {
      throw await this.createError(pathOrUrl, response);
    }

    return response;
  }

  private async createError(pathOrUrl: string, response: Response): Promise<AutoCliError> {
    const text = await response.text().catch(() => "");
    let message = `Google API request failed with status ${response.status}.`;

    if (text) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const record = parsed as Record<string, unknown>;
          const direct = typeof record.message === "string" ? record.message : undefined;
          const nested = record.error && typeof record.error === "object" && !Array.isArray(record.error)
            ? (record.error as Record<string, unknown>).message
            : undefined;
          if (typeof direct === "string" && direct.trim().length > 0) {
            message = direct.trim();
          } else if (typeof nested === "string" && nested.trim().length > 0) {
            message = nested.trim();
          }
        }
      } catch {
        message = text.slice(0, 200);
      }
    }

    return new AutoCliError(this.options.errorCode, message, {
      details: {
        pathOrUrl,
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  private fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? fetch;
  }
}

function buildUrl(baseUrl: string, pathOrUrl: string, query?: Record<string, QueryValue>): string {
  const url = /^https?:\/\//u.test(pathOrUrl) ? new URL(pathOrUrl) : new URL(pathOrUrl, withTrailingSlash(baseUrl));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function withTrailingSlash(input: string): string {
  return input.endsWith("/") ? input : `${input}/`;
}

function normalizeBody(
  body: BodyInit | JsonLikeBody | Buffer | ArrayBuffer | ArrayBufferView | null | undefined,
  headers: Headers,
): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    body instanceof URLSearchParams ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return body as unknown as BodyInit;
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as BodyInit;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return JSON.stringify(body);
}

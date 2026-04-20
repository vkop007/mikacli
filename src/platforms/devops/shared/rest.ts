import { MikaCliError } from "../../../errors.js";

export class BearerJsonClient {
  constructor(
    private readonly options: {
      baseUrl: string;
      token: string;
      errorCode: string;
      fetchImpl?: typeof fetch;
      headers?: Record<string, string>;
    },
  ) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.options.token}`);
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");
    headers.set("user-agent", "MikaCLI/0.1 (+https://github.com/vkop007/mikacli)");

    for (const [key, value] of Object.entries(this.options.headers ?? {})) {
      headers.set(key, value);
    }

    const response = await fetchImpl(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const text = await response.text();
    const payload = text.length > 0 ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw new MikaCliError(this.options.errorCode, extractErrorMessage(payload, response.status), {
        details: {
          status: response.status,
          path,
        },
      });
    }

    if (payload === undefined) {
      throw new MikaCliError(this.options.errorCode, "The remote API returned an empty response.", {
        details: { path },
      });
    }

    return payload as T;
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function extractArray<T>(payload: unknown, keys: readonly string[]): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (isObject(payload)) {
    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }
  }

  return [];
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (isObject(payload)) {
    const direct = ["message", "error", "error_description"].map((key) => payload[key]).find((value) => typeof value === "string");
    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct.trim();
    }

    if (isObject(payload.error) && typeof payload.error.message === "string" && payload.error.message.trim().length > 0) {
      return payload.error.message.trim();
    }
  }

  return `API request failed with status ${status}.`;
}

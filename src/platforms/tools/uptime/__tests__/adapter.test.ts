import { afterEach, describe, expect, test } from "bun:test";

import { uptimeAdapter } from "../adapter.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("uptime adapter", () => {
  test("checks a site with HEAD by default", async () => {
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("HEAD");
      return new Response("", {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-length": "1234",
        },
      });
    }) as unknown as typeof fetch;

    const result = await uptimeAdapter.uptime({
      target: "example.com",
    });

    expect(result.ok).toBe(true);
    expect(String(result.platform)).toBe("uptime");
    expect(result.data?.status).toBe(200);
    expect(result.data?.healthy).toBe(true);
    expect(result.data?.method).toBe("HEAD");
  });

  test("falls back to GET when HEAD is not allowed", async () => {
    let requestCount = 0;
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      requestCount += 1;
      if (requestCount === 1) {
        expect(init?.method).toBe("HEAD");
        return new Response("", { status: 405, statusText: "Method Not Allowed" });
      }

      expect(init?.method).toBe("GET");
      return new Response("", { status: 200, statusText: "OK" });
    }) as unknown as typeof fetch;

    const result = await uptimeAdapter.uptime({
      target: "https://example.com",
    });

    expect(requestCount).toBe(2);
    expect(result.data?.status).toBe(200);
    expect(result.data?.method).toBe("GET");
  });
});

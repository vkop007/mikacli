import { describe, expect, test } from "bun:test";

import { SessionHttpClient } from "../http-client.js";

describe("SessionHttpClient", () => {
  test("retries retryable responses with exponential backoff", async () => {
    const delays: number[] = [];
    let attempts = 0;

    const client = new SessionHttpClient(
      undefined,
      {},
      ((async () => {
        attempts += 1;

        if (attempts < 3) {
          return new Response(JSON.stringify({ error: "busy" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown) as typeof fetch,
      async (delayMs) => {
        delays.push(delayMs);
      },
    );

    const result = await client.request<{ ok: boolean }>("https://example.com/api");

    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(3);
    expect(delays).toEqual([1_000, 2_000]);
  });

  test("respects Retry-After delays for rate-limited responses", async () => {
    const delays: number[] = [];
    let attempts = 0;

    const client = new SessionHttpClient(
      undefined,
      {},
      ((async () => {
        attempts += 1;

        if (attempts === 1) {
          return new Response(JSON.stringify({ error: "rate_limited" }), {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "3",
            },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown) as typeof fetch,
      async (delayMs) => {
        delays.push(delayMs);
      },
    );

    const result = await client.request<{ ok: boolean }>("https://example.com/api");

    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(2);
    expect(delays).toEqual([3_000]);
  });

  test("does not retry statuses that the caller explicitly expects", async () => {
    const delays: number[] = [];
    let attempts = 0;

    const client = new SessionHttpClient(
      undefined,
      {},
      ((async () => {
        attempts += 1;
        return new Response("rate limited but intentionally handled upstream", {
          status: 429,
        });
      }) as unknown) as typeof fetch,
      async (delayMs) => {
        delays.push(delayMs);
      },
    );

    const { data, response } = await client.requestWithResponse<string>("https://example.com/api", {
      responseType: "text",
      expectedStatus: [200, 429],
    });

    expect(data).toBe("rate limited but intentionally handled upstream");
    expect(response.status).toBe(429);
    expect(attempts).toBe(1);
    expect(delays).toEqual([]);
  });

  test("fails immediately for non-retryable statuses", async () => {
    let attempts = 0;

    const client = new SessionHttpClient(
      undefined,
      {},
      ((async () => {
        attempts += 1;
        return new Response(JSON.stringify({ error: "bad request" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }) as unknown) as typeof fetch,
    );

    await expect(client.request("https://example.com/api")).rejects.toMatchObject({
      code: "HTTP_REQUEST_FAILED",
      details: {
        status: 400,
        attempts: 1,
      },
    });
    expect(attempts).toBe(1);
  });

  test("allows retries to be disabled per request", async () => {
    let attempts = 0;

    const client = new SessionHttpClient(
      undefined,
      {},
      ((async () => {
        attempts += 1;
        return new Response(JSON.stringify({ error: "busy" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }) as unknown) as typeof fetch,
    );

    await expect(
      client.request("https://example.com/api", {
        retries: 0,
      }),
    ).rejects.toMatchObject({
      code: "HTTP_REQUEST_FAILED",
      details: {
        status: 503,
        attempts: 1,
      },
    });
    expect(attempts).toBe(1);
  });
});

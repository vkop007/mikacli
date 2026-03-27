import { afterEach, describe, expect, test } from "bun:test";

import { currencyAdapter, parseOpenErApiResponse } from "../adapter.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("currency adapter", () => {
  test("parses an open.er-api response payload", () => {
    const parsed = parseOpenErApiResponse({
      result: "success",
      base_code: "USD",
      time_last_update_utc: "Fri, 27 Mar 2026 00:02:31 +0000",
      rates: {
        INR: 94.12,
        EUR: 0.92,
      },
    });

    expect(parsed).toEqual({
      baseCode: "USD",
      date: "Fri, 27 Mar 2026 00:02:31 +0000",
      rates: {
        INR: 94.12,
        EUR: 0.92,
      },
    });
  });

  test("converts currency using the public exchange-rate endpoint", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          result: "success",
          base_code: "USD",
          time_last_update_utc: "Fri, 27 Mar 2026 00:02:31 +0000",
          rates: {
            INR: 94.12,
            EUR: 0.92,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as unknown as typeof fetch;

    const result = await currencyAdapter.currency({
      amount: "100",
      from: "usd",
      to: ["inr", "eur"],
    });

    expect(result.ok).toBe(true);
    expect(String(result.platform)).toBe("currency");
    expect(result.data?.from).toBe("USD");
    expect(result.data?.baseCode).toBe("USD");
    expect(Array.isArray(result.data?.conversions)).toBe(true);
    expect(result.data?.conversions).toEqual([
      { code: "INR", rate: 94.12, value: 9412 },
      { code: "EUR", rate: 0.92, value: 92 },
    ]);
  });
});

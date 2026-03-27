import { describe, expect, test } from "bun:test";

import { buildCurrencyUrl, parseCurrencyResponse } from "../adapter.js";

describe("currency adapter helpers", () => {
  test("builds the open.er-api url", () => {
    const url = buildCurrencyUrl({
      amount: 100,
      from: "USD",
      to: ["EUR", "INR"],
    });
    expect(url).toBe("https://open.er-api.com/v6/latest/USD");
  });

  test("parses requested rates from the api response", () => {
    const parsed = parseCurrencyResponse(
      {
        base: "USD",
        date: "2026-03-27",
        rates: {
          EUR: 0.93,
          INR: 83.12,
        },
      },
      ["EUR", "INR"],
    );

    expect(parsed).toEqual({
      base: "USD",
      date: "2026-03-27",
      rates: {
        EUR: 0.93,
        INR: 83.12,
      },
    });
  });
});

import { describe, expect, test } from "bun:test";

import { buildStockQuoteUrl, normalizeStockSymbol, parseStockQuote } from "../adapter.js";

describe("stocks public tools", () => {
  test("normalizes a symbol into the stooq format", () => {
    expect(normalizeStockSymbol("AAPL")).toBe("aapl.us");
    expect(normalizeStockSymbol("aapl.us")).toBe("aapl.us");
  });

  test("builds the stooq csv url", () => {
    expect(buildStockQuoteUrl("aapl.us")).toBe("https://stooq.com/q/l/?s=aapl.us&i=d&f=sd2t2ohlcv&h=&e=csv");
  });

  test("parses the stooq csv quote", () => {
    const quote = parseStockQuote("Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-03-26,22:00:00,170.10,171.20,169.80,170.90,123456");

    expect(quote).toEqual({
      symbol: "AAPL.US",
      date: "2026-03-26",
      time: "22:00:00",
      open: 170.1,
      high: 171.2,
      low: 169.8,
      close: 170.9,
      volume: 123456,
    });
  });

  test("parses the compact stooq row format", () => {
    const quote = parseStockQuote("AAPL.US,20260326,210016,252.115,257,250.77,252.89,41796650,");

    expect(quote).toEqual({
      symbol: "AAPL.US",
      date: "20260326",
      time: "210016",
      open: 252.115,
      high: 257,
      low: 250.77,
      close: 252.89,
      volume: 41796650,
    });
  });
});

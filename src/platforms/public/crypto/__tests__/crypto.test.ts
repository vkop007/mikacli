import { describe, expect, test } from "bun:test";

import { normalizeCryptoAsset, normalizeCryptoCurrency, selectBestCryptoMatch } from "../adapter.js";

describe("crypto public tools", () => {
  test("normalizes the asset and quote currency", () => {
    expect(normalizeCryptoAsset(" Bitcoin ")).toBe("bitcoin");
    expect(normalizeCryptoCurrency(" USD ")).toBe("usd");
  });

  test("selects the best coin match from search results", () => {
    const match = selectBestCryptoMatch("btc", [
      { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
      { id: "ethereum", symbol: "eth", name: "Ethereum" },
    ]);

    expect(match).toEqual({ id: "bitcoin", symbol: "btc", name: "Bitcoin" });
  });
});

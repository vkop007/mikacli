import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { cryptoAdapter, type CryptoAdapter } from "../adapter.js";
import { printCryptoResult } from "../output.js";

export function createCryptoPriceCapability(adapter: CryptoAdapter) {
  return createAdapterActionCapability({
    id: "price",
    command: "price <asset>",
    aliases: ["crypto"],
    description: "Load a crypto price from the public CoinGecko API",
    spinnerText: "Loading crypto price...",
    successMessage: "Crypto price loaded.",
    options: [{ flags: "--vs <currency>", description: "Quote currency such as usd, inr, eur (default: usd)" }],
    action: ({ args, options }) =>
      adapter.price({
        asset: String(args[0] ?? ""),
        vs: options.vs as string | undefined,
      }),
    onSuccess: printCryptoResult,
  });
}

export const cryptoPriceCapability = createCryptoPriceCapability(cryptoAdapter);

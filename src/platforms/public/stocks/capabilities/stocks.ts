import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { stocksAdapter, type StocksAdapter } from "../adapter.js";
import { printStocksResult } from "../output.js";

export function createStocksQuoteCapability(adapter: StocksAdapter) {
  return createAdapterActionCapability({
    id: "quote",
    command: "quote <symbol>",
    aliases: ["stocks"],
    description: "Load a stock quote from the public Stooq endpoint",
    spinnerText: "Loading stock quote...",
    successMessage: "Stock quote loaded.",
    options: [{ flags: "--market <code>", description: "Market suffix for symbols without an exchange suffix (default: us)" }],
    action: ({ args, options }) =>
      adapter.quote({
        symbol: String(args[0] ?? ""),
        market: options.market as string | undefined,
      }),
    onSuccess: printStocksResult,
  });
}

export const stocksQuoteCapability = createStocksQuoteCapability(stocksAdapter);

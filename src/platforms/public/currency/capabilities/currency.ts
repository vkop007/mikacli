import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { currencyAdapter, type CurrencyAdapter } from "../adapter.js";
import { printCurrencyResult } from "../output.js";

export function createCurrencyCapability(adapter: CurrencyAdapter) {
  return createAdapterActionCapability({
    id: "currency",
    command: "currency <amount> <from> <to...>",
    description: "Convert currencies using a public no-key exchange-rate endpoint",
    spinnerText: "Loading currency conversion...",
    successMessage: "Currency conversion loaded.",
    options: [],
    action: ({ args }) =>
      adapter.currency({
        amount: String(args[0] ?? ""),
        from: String(args[1] ?? ""),
        to: args.slice(2).map(String),
      }),
    onSuccess: printCurrencyResult,
  });
}

export const currencyCapability = createCurrencyCapability(currencyAdapter);

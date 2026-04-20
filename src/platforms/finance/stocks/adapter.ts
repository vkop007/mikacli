import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

export type StockLookupInput = {
  symbol: string;
  market?: string;
};

export type StockQuote = {
  symbol: string;
  date?: string;
  time?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export class StocksAdapter {
  readonly platform: Platform = "stocks" as Platform;
  readonly displayName = "Stocks";

  async quote(input: StockLookupInput): Promise<AdapterActionResult> {
    const symbol = normalizeStockSymbol(input.symbol, input.market);
    const url = buildStockQuoteUrl(symbol);
    const payload = await fetchStockCsv(url);
    const quote = parseStockQuote(payload);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "quote",
      message: `Loaded stock quote for ${quote.symbol}.`,
      data: {
        symbol: quote.symbol,
        quote,
        source: url,
      },
    };
  }
}

export const stocksAdapter = new StocksAdapter();

export function normalizeStockSymbol(symbol: string, market?: string): string {
  const cleaned = symbol.trim().toLowerCase();
  if (!cleaned) {
    throw new MikaCliError("STOCK_SYMBOL_REQUIRED", "Stock symbol cannot be empty.");
  }

  if (cleaned.includes(".")) {
    return cleaned;
  }

  const suffix = (market?.trim() || "us").toLowerCase();
  return `${cleaned}.${suffix}`;
}

export function buildStockQuoteUrl(symbol: string): string {
  const url = new URL("https://stooq.com/q/l/");
  url.searchParams.set("s", symbol);
  url.searchParams.set("i", "d");
  url.searchParams.set("f", "sd2t2ohlcv");
  url.searchParams.set("h", "");
  url.searchParams.set("e", "csv");
  return url.toString();
}

export function parseStockQuote(csv: string): StockQuote {
  const lines = csv
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 1) {
    throw new MikaCliError("STOCK_RESPONSE_INVALID", "Stock quote response did not include a data row.");
  }

  const firstFields = (lines[0] ?? "").split(",").map((value) => value.trim().toLowerCase());
  const hasHeader = firstFields.includes("symbol") && firstFields.includes("date") && firstFields.includes("close");
  const headers = hasHeader
    ? lines[0]?.split(",").map((value) => value.trim().toLowerCase()) ?? []
    : ["symbol", "date", "time", "open", "high", "low", "close", "volume"];
  const values = (hasHeader ? lines[1] : lines[0])?.split(",").map((value) => value.trim()) ?? [];
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

  const symbol = asString(row.symbol) || "";
  if (!symbol || symbol.toUpperCase() === "N/D") {
    throw new MikaCliError("STOCK_NOT_FOUND", "The stock symbol could not be resolved.");
  }

  return {
    symbol,
    date: normalizeOptionalString(asString(row.date)),
    time: normalizeOptionalString(asString(row.time)),
    open: asNumber(row.open),
    high: asNumber(row.high),
    low: asNumber(row.low),
    close: asNumber(row.close),
    volume: asNumber(row.volume),
  };
}

async function fetchStockCsv(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        accept: "text/csv,text/plain,*/*",
        "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new MikaCliError("STOCK_LOOKUP_FAILED", "Unable to reach the stock quote service.", {
      cause: error,
      details: { url },
    });
  }

  if (!response.ok) {
    throw new MikaCliError("STOCK_LOOKUP_FAILED", `Stock quote lookup failed with ${response.status} ${response.statusText}.`, {
      details: {
        url,
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  return await response.text();
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

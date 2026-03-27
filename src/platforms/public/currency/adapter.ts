import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

type CurrencyLookupInput = {
  amount: number | string;
  from: string;
  to: string[];
};

type OpenErApiResponse = {
  result?: string;
  provider?: string;
  documentation?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  base_code?: string;
  rates?: Record<string, number>;
};

type CurrencyConversion = {
  code: string;
  rate: number;
  value: number;
};

export class CurrencyAdapter {
  readonly platform = "currency" as Platform;
  readonly displayName = "Currency";

  async currency(input: CurrencyLookupInput): Promise<AdapterActionResult> {
    const amount = normalizeAmount(input.amount);
    const from = normalizeCurrencyCode(input.from);
    const targets = normalizeCurrencyCodes(input.to);

    if (targets.length === 0) {
      throw new AutoCliError("CURRENCY_TARGET_REQUIRED", "Expected at least one target currency code.");
    }

    const quote = await this.lookupRates(from);
    const conversions = buildConversions(amount, targets, quote.rates);
    const missing = conversions.filter((conversion) => !Number.isFinite(conversion.rate));

    if (missing.length > 0) {
      throw new AutoCliError("CURRENCY_RATE_MISSING", "One or more requested currencies were not returned by the rate provider.", {
        details: {
          missing: missing.map((entry) => entry.code),
          from,
        },
      });
    }

    return this.buildResult({
      action: "currency",
      message: `Converted ${formatNumber(amount)} ${from} into ${conversions.length} currencies.`,
      data: {
        amount,
        from,
        baseCode: quote.baseCode,
        date: quote.date,
        sourceUrl: quote.sourceUrl,
        provider: quote.provider,
        conversions: conversions.map((entry) => ({
          code: entry.code,
          rate: entry.rate,
          value: entry.value,
        })),
      },
    });
  }

  private async lookupRates(base: string): Promise<{
    provider: string;
    sourceUrl: string;
    baseCode: string;
    date: string;
    rates: Record<string, number>;
  }> {
    const sourceUrl = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;

    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          "user-agent": "AutoCLI/1.0 (+https://github.com/)",
        },
      });
    } catch (error) {
      throw new AutoCliError("CURRENCY_REQUEST_FAILED", "Unable to reach the public exchange-rate endpoint.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    if (!response.ok) {
      throw new AutoCliError(
        "CURRENCY_REQUEST_FAILED",
        `The exchange-rate endpoint returned HTTP ${response.status} ${response.statusText}.`,
        {
          details: {
            sourceUrl,
            status: response.status,
            statusText: response.statusText,
          },
        },
      );
    }

    let payload: unknown;
    try {
      payload = (await response.json()) as OpenErApiResponse;
    } catch (error) {
      throw new AutoCliError("CURRENCY_RESPONSE_INVALID", "The exchange-rate endpoint returned invalid JSON.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    const parsed = parseOpenErApiResponse(payload);
    if (!parsed.rates) {
      throw new AutoCliError("CURRENCY_RESPONSE_INVALID", "The exchange-rate response did not include rate data.", {
        details: {
          sourceUrl,
        },
      });
    }

    return {
      provider: "open.er-api.com",
      sourceUrl,
      baseCode: parsed.baseCode,
      date: parsed.date,
      rates: parsed.rates,
    };
  }

  private buildResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const currencyAdapter = new CurrencyAdapter();

export function parseOpenErApiResponse(payload: unknown): {
  baseCode: string;
  date: string;
  rates: Record<string, number> | undefined;
} {
  if (!payload || typeof payload !== "object") {
    return {
      baseCode: "",
      date: "",
      rates: undefined,
    };
  }

  const record = payload as Record<string, unknown>;
  const baseCode = typeof record.base_code === "string" ? record.base_code.trim().toUpperCase() : "";
  const date = typeof record.time_last_update_utc === "string" ? record.time_last_update_utc.trim() : "";
  const rates = parseRates(record.rates);

  return {
    baseCode,
    date,
    rates,
  };
}

export function buildCurrencyUrl(input: { amount: number; from: string; to: string[] }): string {
  return `https://open.er-api.com/v6/latest/${encodeURIComponent(input.from)}`;
}

export function parseCurrencyResponse(payload: unknown, targets: string[]): {
  base?: string;
  date?: string;
  rates: Record<string, number>;
} {
  if (!payload || typeof payload !== "object") {
    return { rates: {} };
  }

  const record = payload as Record<string, unknown>;
  const ratesSource = record.rates && typeof record.rates === "object" ? (record.rates as Record<string, unknown>) : {};
  const rates: Record<string, number> = {};

  for (const target of targets) {
    const value = ratesSource[target];
    if (typeof value === "number" && Number.isFinite(value)) {
      rates[target] = value;
    }
  }

  return {
    base: typeof record.base === "string" ? record.base : undefined,
    date: typeof record.date === "string" ? record.date : undefined,
    rates,
  };
}

function buildConversions(amount: number, targets: string[], rates: Record<string, number> | undefined): CurrencyConversion[] {
  return targets.map((code) => {
    const rate = rates?.[code];
    return {
      code,
      rate: typeof rate === "number" && Number.isFinite(rate) ? rate : Number.NaN,
      value: typeof rate === "number" && Number.isFinite(rate) ? amount * rate : Number.NaN,
    };
  });
}

function parseRates(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rates: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      rates[key.toUpperCase()] = raw;
    }
  }

  return Object.keys(rates).length > 0 ? rates : undefined;
}

function normalizeAmount(value: number | string): number {
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AutoCliError("CURRENCY_AMOUNT_INVALID", `Invalid currency amount "${value}".`);
  }

  return amount;
}

function normalizeCurrencyCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!code) {
    throw new AutoCliError("CURRENCY_CODE_INVALID", "Expected a currency code.");
  }

  return code;
}

function normalizeCurrencyCodes(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.toUpperCase());
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(value);
}

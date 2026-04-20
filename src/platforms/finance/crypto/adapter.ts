import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

export type CryptoLookupInput = {
  asset: string;
  vs?: string;
};

export type CryptoMatch = {
  id: string;
  symbol: string;
  name: string;
  marketCapRank?: number;
};

export class CryptoAdapter {
  readonly platform: Platform = "crypto" as Platform;
  readonly displayName = "Crypto";
  private coinListPromise?: Promise<CryptoMatch[]>;

  async price(input: CryptoLookupInput): Promise<AdapterActionResult> {
    const asset = normalizeCryptoAsset(input.asset);
    const vsCurrency = normalizeCryptoCurrency(input.vs);
    const match = await this.resolveAsset(asset);
    const price = await this.fetchPrice(match.symbol, vsCurrency);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "price",
      message: `Loaded ${match.name} (${match.symbol.toUpperCase()}) price in ${vsCurrency.toUpperCase()}.`,
      data: {
        asset,
        id: match.id,
        symbol: match.symbol,
        name: match.name,
        marketCapRank: match.marketCapRank ?? null,
        vsCurrency,
        price: price.price,
        change24h: price.change24h ?? null,
        marketCap: price.marketCap ?? null,
        source: price.source,
      },
    };
  }

  private async resolveAsset(asset: string): Promise<CryptoMatch> {
    const direct = await this.trySimplePriceLookup(asset);
    if (direct) {
      return direct;
    }

    const matches = await this.fetchCryptoSearch(asset);
    const best = selectBestCryptoMatch(asset, matches);
    if (!best) {
      throw new MikaCliError("CRYPTO_NOT_FOUND", `Could not resolve crypto asset "${asset}".`);
    }

    return best;
  }

  private async trySimplePriceLookup(asset: string): Promise<CryptoMatch | undefined> {
    const directSymbol = asset.trim().toUpperCase();
    const price = await this.fetchPriceMaybe(directSymbol, "usd");
    if (!price) {
      return undefined;
    }

    return {
      id: asset.toLowerCase(),
      symbol: directSymbol,
      name: asset,
    };
  }

  private async fetchCryptoSearch(query: string): Promise<CryptoMatch[]> {
    const normalized = query.trim().toLowerCase();
    const coins = await this.fetchCoinList();
    return coins.filter((entry) => {
      const id = entry.id.toLowerCase();
      const symbol = entry.symbol.toLowerCase();
      const name = entry.name.toLowerCase();
      return id === normalized || symbol === normalized || name === normalized || id.startsWith(normalized) || symbol.startsWith(normalized) || name.startsWith(normalized);
    });
  }

  private async fetchCoinList(): Promise<CryptoMatch[]> {
    if (!this.coinListPromise) {
      this.coinListPromise = this.loadCoinList();
    }

    return this.coinListPromise;
  }

  private async loadCoinList(): Promise<CryptoMatch[]> {
    const url = new URL("https://min-api.cryptocompare.com/data/all/coinlist");

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("CRYPTO_LOOKUP_FAILED", "Unable to reach the crypto lookup service.", {
        cause: error,
        details: { url: url.toString() },
      });
    }

    if (!response.ok) {
      throw new MikaCliError("CRYPTO_LOOKUP_FAILED", `Crypto lookup failed with ${response.status} ${response.statusText}.`, {
        details: {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const data = toRecord(payload.Data);
    if (!data) {
      return [];
    }

    return Object.values(data)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => {
        const symbol = asString(entry.Symbol) ?? asString(entry.Name) ?? "";
        const name = asString(entry.CoinName) ?? asString(entry.FullName) ?? symbol;
        const id = slugifyCryptoName(name, symbol);

        return {
          id,
          symbol,
          name,
        } satisfies CryptoMatch;
      })
      .filter((entry) => Boolean(entry.id) && Boolean(entry.symbol) && Boolean(entry.name));
  }

  private async fetchPrice(symbol: string, vsCurrency: string): Promise<{ price: number; change24h?: number; marketCap?: number; source: string }> {
    const price = await this.fetchPriceMaybe(symbol, vsCurrency);
    if (!price) {
      throw new MikaCliError("CRYPTO_PRICE_NOT_FOUND", `Crypto price not found for "${symbol}".`);
    }

    return price;
  }

  private async fetchPriceMaybe(symbol: string, vsCurrency: string): Promise<{ price: number; change24h?: number; marketCap?: number; source: string } | undefined> {
    const symbolCode = symbol.trim().toUpperCase();
    const quoteCode = vsCurrency.trim().toUpperCase();
    const url = new URL("https://min-api.cryptocompare.com/data/pricemultifull");
    url.searchParams.set("fsyms", symbolCode);
    url.searchParams.set("tsyms", quoteCode);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("CRYPTO_LOOKUP_FAILED", "Unable to reach the crypto price service.", {
        cause: error,
        details: { url: url.toString() },
      });
    }

    if (!response.ok) {
      throw new MikaCliError("CRYPTO_LOOKUP_FAILED", `Crypto price lookup failed with ${response.status} ${response.statusText}.`, {
        details: {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const raw = toRecord(payload.RAW);
    const symbolEntry = raw ? toRecord(raw[symbolCode]) : undefined;
    const entry = symbolEntry ? toRecord(symbolEntry[quoteCode]) : undefined;
    if (!entry) {
      return undefined;
    }

    const price = asNumber(entry.PRICE);
    if (price === undefined) {
      return undefined;
    }

    return {
      price,
      change24h: asNumber(entry.CHANGEPCT24HOUR),
      marketCap: asNumber(entry.MKTCAP),
      source: url.toString(),
    };
  }
}

export const cryptoAdapter = new CryptoAdapter();

export function normalizeCryptoAsset(value: string): string {
  const asset = value.trim().toLowerCase();
  if (!asset) {
    throw new MikaCliError("CRYPTO_ASSET_REQUIRED", "Crypto asset cannot be empty.");
  }

  return asset;
}

export function normalizeCryptoCurrency(value?: string): string {
  const currency = (value ?? "usd").trim().toLowerCase();
  if (!currency) {
    throw new MikaCliError("CRYPTO_CURRENCY_REQUIRED", "Crypto quote currency cannot be empty.");
  }

  return currency;
}

export function selectBestCryptoMatch(asset: string, matches: CryptoMatch[]): CryptoMatch | undefined {
  const normalized = asset.trim().toLowerCase();
  const exactSymbol = matches.find((match) => match.symbol.toLowerCase() === normalized);
  if (exactSymbol) {
    return exactSymbol;
  }

  const exactName = matches.find((match) => match.name.toLowerCase() === normalized);
  if (exactName) {
    return exactName;
  }

  const partial = matches.find((match) => match.symbol.toLowerCase().startsWith(normalized) || match.name.toLowerCase().startsWith(normalized));
  return partial ?? matches[0];
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function slugifyCryptoName(name: string, symbol: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || symbol.trim().toLowerCase();
}

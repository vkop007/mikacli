import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

type WeatherLookupInput = {
  location?: string;
  days?: number;
  lang?: string;
};

type WeatherLocation = {
  area?: string;
  region?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
  label: string;
};

type WeatherCurrent = {
  condition: string;
  temperatureC?: number;
  feelsLikeC?: number;
  humidityPercent?: number;
  windKmph?: number;
  windDirection?: string;
  observationTime?: string;
};

type WeatherDailySummary = {
  date?: string;
  condition?: string;
  minTempC?: number;
  maxTempC?: number;
  avgTempC?: number;
};

export class WeatherAdapter {
  readonly platform: Platform = "weather" as Platform;
  readonly displayName = "Weather";

  async weather(input: WeatherLookupInput): Promise<AdapterActionResult> {
    const location = normalizeOptionalString(input.location);
    const days = clamp(Math.trunc(input.days ?? 1), 1, 3);
    const lang = normalizeOptionalString(input.lang);
    const url = buildWeatherUrl({ location, lang });

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          accept: "application/json",
          "user-agent": "MikaCLI/1.0 (+https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("WEATHER_REQUEST_FAILED", "Unable to reach wttr.in weather service.", {
        details: {
          location: location ?? "auto",
        },
        cause: error,
      });
    }

    if (!response.ok) {
      throw new MikaCliError(
        "WEATHER_REQUEST_FAILED",
        `wttr.in weather request failed with ${response.status} ${response.statusText}.`,
        {
          details: {
            status: response.status,
            location: location ?? "auto",
          },
        },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new MikaCliError("WEATHER_RESPONSE_INVALID", "wttr.in returned invalid JSON weather data.", {
        cause: error,
      });
    }

    const parsed = parseWeatherPayload(payload, days);

    return this.buildResult({
      action: "weather",
      message: `Loaded weather for ${parsed.location.label}.`,
      data: {
        location: parsed.location,
        current: parsed.current,
        forecast: parsed.forecast,
        requestedDays: days,
        lang: lang ?? null,
        source: "https://wttr.in/?format=j1",
      },
    });
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

export const weatherAdapter = new WeatherAdapter();

function parseWeatherPayload(payload: unknown, days: number): {
  location: WeatherLocation;
  current: WeatherCurrent;
  forecast: WeatherDailySummary[];
} {
  const root = asRecord(payload);

  const currentRaw = firstRecord(root.current_condition);
  if (!currentRaw) {
    throw new MikaCliError("WEATHER_RESPONSE_INVALID", "wttr.in response did not include current conditions.");
  }

  const nearestAreaRaw = firstRecord(root.nearest_area);
  const location = parseLocation(nearestAreaRaw);
  const current = parseCurrent(currentRaw);
  const forecast = asRecordArray(root.weather)
    .slice(0, days)
    .map((entry) => parseDailySummary(entry));

  return { location, current, forecast };
}

function parseLocation(raw: Record<string, unknown> | undefined): WeatherLocation {
  const area = firstValueText(raw?.areaName);
  const region = firstValueText(raw?.region);
  const country = firstValueText(raw?.country);
  const latitude = normalizeOptionalString(asString(raw?.latitude));
  const longitude = normalizeOptionalString(asString(raw?.longitude));

  const label = [area, region, country].filter((value): value is string => Boolean(value)).join(", ");

  return {
    area,
    region,
    country,
    latitude,
    longitude,
    label: label || "your area",
  };
}

function parseCurrent(raw: Record<string, unknown>): WeatherCurrent {
  return {
    condition: firstValueText(raw.weatherDesc) ?? "Unknown conditions",
    temperatureC: asNumber(raw.temp_C),
    feelsLikeC: asNumber(raw.FeelsLikeC),
    humidityPercent: asNumber(raw.humidity),
    windKmph: asNumber(raw.windspeedKmph),
    windDirection: normalizeOptionalString(asString(raw.winddir16Point)),
    observationTime: normalizeOptionalString(asString(raw.observation_time)),
  };
}

function parseDailySummary(raw: Record<string, unknown>): WeatherDailySummary {
  const hourly = asRecordArray(raw.hourly);
  const sampledHour = hourly[Math.floor(hourly.length / 2)] ?? hourly[0];

  return {
    date: normalizeOptionalString(asString(raw.date)),
    condition: firstValueText(sampledHour?.weatherDesc),
    minTempC: asNumber(raw.mintempC),
    maxTempC: asNumber(raw.maxtempC),
    avgTempC: asNumber(raw.avgtempC),
  };
}

function buildWeatherUrl(input: { location?: string; lang?: string }): string {
  const encodedLocation = input.location ? `/${encodeURIComponent(input.location)}` : "";
  const url = new URL(`https://wttr.in${encodedLocation}`);
  url.searchParams.set("format", "j1");

  if (input.lang) {
    url.searchParams.set("lang", input.lang);
  }

  return url.toString();
}

function firstValueText(value: unknown): string | undefined {
  for (const entry of asRecordArray(value)) {
    const text = normalizeOptionalString(asString(entry.value));
    if (text) {
      return text;
    }
  }

  return undefined;
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  const entries = asRecordArray(value);
  return entries[0];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

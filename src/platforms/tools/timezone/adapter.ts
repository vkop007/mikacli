import { AutoCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type TimezoneInput = {
  target?: string;
  lat?: number;
  lon?: number;
  timeoutMs?: number;
};

type ResolvedTimezoneContext =
  | { kind: "ip"; timezone: string; latitude?: number; longitude?: number; placeName?: string; country?: string; source: string }
  | { kind: "timezone"; timezone: string; source: string }
  | { kind: "coordinates"; timezone: string; latitude: number; longitude: number; placeName?: string; source: string; abbreviation?: string; utcOffset?: string; elevation?: number }
  | { kind: "place"; timezone: string; latitude: number; longitude: number; placeName: string; country?: string; source: string; abbreviation?: string; utcOffset?: string; elevation?: number };

type TimezoneRecord = {
  timezone: string;
  abbreviation?: string;
  utcOffset?: string;
  hasDaylightSaving?: boolean;
  isDaylightSavingActive?: boolean;
  localDatetime?: string;
  source: string[];
  kind: ResolvedTimezoneContext["kind"];
  latitude?: number;
  longitude?: number;
  elevation?: number;
  placeName?: string;
  country?: string;
};

export class TimezoneAdapter {
  readonly platform: Platform = "timezone" as Platform;
  readonly displayName = "Timezone";

  async inspect(input: TimezoneInput): Promise<AdapterActionResult> {
    const timeoutMs = clampNumber(input.timeoutMs ?? 15000, 1000, 60000);
    const context = await this.resolveContext(input, timeoutMs);
    const zoneInfo = await this.fetchZoneInfo(context.timezone, timeoutMs);
    const currentTime = await this.fetchCurrentTime(context.timezone, timeoutMs).catch(() => undefined);

    const record: TimezoneRecord = {
      kind: context.kind,
      timezone: context.timezone,
      abbreviation: zoneInfo.abbreviation ?? ("abbreviation" in context ? context.abbreviation : undefined),
      utcOffset: zoneInfo.utcOffset ?? ("utcOffset" in context ? context.utcOffset : undefined),
      hasDaylightSaving: zoneInfo.hasDaylightSaving,
      isDaylightSavingActive: zoneInfo.isDaylightSavingActive,
      localDatetime: currentTime?.dateTime,
      source: [context.source, zoneInfo.source, ...(currentTime ? [currentTime.source] : [])],
      latitude: "latitude" in context ? context.latitude : undefined,
      longitude: "longitude" in context ? context.longitude : undefined,
      elevation: "elevation" in context ? context.elevation : undefined,
      placeName: "placeName" in context ? context.placeName : undefined,
      country: "country" in context ? context.country : undefined,
    };

    const label =
      record.placeName ??
      ("latitude" in context && "longitude" in context ? `${context.latitude}, ${context.longitude}` : undefined) ??
      context.timezone;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "timezone",
      message: `Resolved timezone metadata for ${label}.`,
      data: record,
    };
  }

  private async resolveContext(input: TimezoneInput, timeoutMs: number): Promise<ResolvedTimezoneContext> {
    if (typeof input.lat === "number" || typeof input.lon === "number") {
      if (typeof input.lat !== "number" || typeof input.lon !== "number") {
        throw new AutoCliError("TIMEZONE_COORDINATES_INVALID", "Provide both --lat and --lon together.");
      }
      return this.resolveFromCoordinates(input.lat, input.lon, timeoutMs);
    }

    const target = input.target?.trim();
    if (!target) {
      return this.resolveFromIp(timeoutMs);
    }

    const coordinateMatch = target.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/u);
    if (coordinateMatch) {
      return this.resolveFromCoordinates(Number.parseFloat(coordinateMatch[1]!), Number.parseFloat(coordinateMatch[2]!), timeoutMs);
    }

    if (looksLikeTimezone(target)) {
      return {
        kind: "timezone",
        timezone: target,
        source: "input",
      };
    }

    return this.resolveFromPlace(target, timeoutMs);
  }

  private async resolveFromIp(timeoutMs: number): Promise<ResolvedTimezoneContext> {
    const response = await fetchJson("https://ipwho.is/", timeoutMs, "TIMEZONE_REQUEST_FAILED", "Unable to infer timezone from IP.");
    const timezone = asString(asRecord(asRecord(response).timezone).id);
    if (!timezone) {
      throw new AutoCliError("TIMEZONE_RESPONSE_INVALID", "The IP timezone provider did not return a timezone identifier.");
    }

    return {
      kind: "ip",
      timezone,
      latitude: asNumber(asRecord(response).latitude),
      longitude: asNumber(asRecord(response).longitude),
      placeName: asString(asRecord(response).city),
      country: asString(asRecord(response).country),
      source: "https://ipwho.is/",
    };
  }

  private async resolveFromPlace(query: string, timeoutMs: number): Promise<ResolvedTimezoneContext> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "AutoCLI/1.0 (+https://github.com/)",
      },
    });

    if (!response.ok) {
      throw new AutoCliError("TIMEZONE_REQUEST_FAILED", `Place lookup failed with ${response.status} ${response.statusText}.`, {
        details: {
          query,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const payload = await response.json();
    const first = Array.isArray(payload) ? asRecord(payload[0]) : {};
    const lat = asNumber(first.lat);
    const lon = asNumber(first.lon);
    if (lat === undefined || lon === undefined) {
      throw new AutoCliError("TIMEZONE_PLACE_NOT_FOUND", `No place match was found for "${query}".`, {
        details: {
          query,
        },
      });
    }

    const coords = await this.resolveFromCoordinates(lat, lon, timeoutMs);
    return {
      kind: "place",
      timezone: coords.timezone,
      latitude: coords.latitude,
      longitude: coords.longitude,
      abbreviation: coords.abbreviation,
      utcOffset: coords.utcOffset,
      elevation: coords.elevation,
      source: coords.source,
      placeName: asString(first.display_name) ?? query,
      country: asString(asRecord(first.address).country),
    };
  }

  private async resolveFromCoordinates(
    lat: number,
    lon: number,
    timeoutMs: number,
  ): Promise<Extract<ResolvedTimezoneContext, { kind: "coordinates" }>> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new AutoCliError("TIMEZONE_COORDINATES_INVALID", "Invalid latitude or longitude.");
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m");
    url.searchParams.set("timezone", "auto");

    const payload = asRecord(await fetchJson(url.toString(), timeoutMs, "TIMEZONE_REQUEST_FAILED", "Unable to resolve timezone from coordinates."));
    const timezone = asString(payload.timezone);
    if (!timezone) {
      throw new AutoCliError("TIMEZONE_RESPONSE_INVALID", "Coordinate lookup did not return a timezone.");
    }

    return {
      kind: "coordinates",
      timezone,
      latitude: lat,
      longitude: lon,
      abbreviation: asString(payload.timezone_abbreviation),
      utcOffset: secondsToOffset(asNumber(payload.utc_offset_seconds)),
      elevation: asNumber(payload.elevation),
      source: "https://api.open-meteo.com/v1/forecast",
    };
  }

  private async fetchZoneInfo(timezone: string, timeoutMs: number): Promise<{
    abbreviation?: string;
    utcOffset?: string;
    hasDaylightSaving?: boolean;
    isDaylightSavingActive?: boolean;
    source: string;
  }> {
    const url = new URL("https://timeapi.io/api/TimeZone/zone");
    url.searchParams.set("timeZone", timezone);
    const payload = asRecord(await fetchJson(url.toString(), timeoutMs, "TIMEZONE_REQUEST_FAILED", "Unable to load timezone metadata."));

    return {
      abbreviation: asString(payload.abbreviation),
      utcOffset: secondsToOffset(asNumber(asRecord(payload.currentUtcOffset).seconds)),
      hasDaylightSaving: asBoolean(payload.hasDayLightSaving),
      isDaylightSavingActive: asBoolean(payload.isDayLightSavingActive),
      source: "https://timeapi.io/api/TimeZone/zone",
    };
  }

  private async fetchCurrentTime(timezone: string, timeoutMs: number): Promise<{
    dateTime?: string;
    source: string;
  }> {
    const url = new URL("https://timeapi.io/api/Time/current/zone");
    url.searchParams.set("timeZone", timezone);
    const payload = asRecord(await fetchJson(url.toString(), timeoutMs, "TIMEZONE_REQUEST_FAILED", "Unable to load current time for the timezone."));

    return {
      dateTime: asString(payload.dateTime),
      source: "https://timeapi.io/api/Time/current/zone",
    };
  }
}

export const timezoneAdapter = new TimezoneAdapter();

export function looksLikeTimezone(value: string): boolean {
  return /^[A-Za-z_]+(?:\/[A-Za-z0-9_\-+]+)+$/u.test(value) || /^(UTC|GMT|Etc\/[A-Za-z0-9_\-+]+)$/u.test(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function fetchJson(url: string, timeoutMs: number, code: string, message: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new AutoCliError(code, message, {
      cause: error,
      details: { url },
    });
  }

  if (!response.ok) {
    throw new AutoCliError(code, `${message} (${response.status} ${response.statusText})`, {
      details: {
        url,
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  return response.json();
}

function secondsToOffset(seconds: number | undefined): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return undefined;
  }

  const sign = seconds >= 0 ? "+" : "-";
  const absolute = Math.abs(Math.trunc(seconds));
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

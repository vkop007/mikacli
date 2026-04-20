import openLocationCodeModule from "open-location-code";

import { MikaCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

interface OpenLocationCodeDecoderResult {
  latitudeLo: number;
  longitudeLo: number;
  latitudeHi: number;
  longitudeHi: number;
  latitudeCenter: number;
  longitudeCenter: number;
  codeLength: number;
}

interface OpenLocationCodeInstance {
  encode(latitude: number, longitude: number, codeLength?: number): string;
  decode(code: string): OpenLocationCodeDecoderResult;
  isValid(code: string): boolean;
}

const OpenLocationCodeCtor = (openLocationCodeModule as { OpenLocationCode: new () => OpenLocationCodeInstance }).OpenLocationCode;
const openLocationCode = new OpenLocationCodeCtor();

type GeoDistanceInput = {
  from: string;
  to: string;
  unit?: string;
};

type GeoMidpointInput = {
  from: string;
  to: string;
};

type GeoPlusCodeEncodeInput = {
  lat: string | number;
  lon: string | number;
  length?: number;
};

type GeoPlusCodeDecodeInput = {
  code: string;
};

type GeoElevationInput = {
  lat: string | number;
  lon: string | number;
  dataset?: string;
};

type Coordinate = {
  lat: number;
  lon: number;
};

type DistanceUnit = "km" | "miles" | "meters";

export class GeoAdapter {
  readonly platform: Platform = "geo" as Platform;
  readonly displayName = "Geo";

  async distance(input: GeoDistanceInput): Promise<AdapterActionResult> {
    const from = parseLatLon(input.from, "from");
    const to = parseLatLon(input.to, "to");
    const unit = normalizeUnit(input.unit);
    const distanceMeters = haversineDistanceMeters(from, to);
    const converted = convertDistance(distanceMeters, unit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "distance",
      message: `Calculated a ${unit} distance of ${converted} between the two points.`,
      data: {
        from: formatCoordinate(from),
        to: formatCoordinate(to),
        unit,
        distanceMeters: round(distanceMeters, 2),
        distanceKm: round(distanceMeters / 1000, 4),
        distanceMiles: round(distanceMeters / 1609.344, 4),
        distance: converted,
      },
    };
  }

  async midpoint(input: GeoMidpointInput): Promise<AdapterActionResult> {
    const from = parseLatLon(input.from, "from");
    const to = parseLatLon(input.to, "to");
    const midpoint = sphericalMidpoint(from, to);
    const plusCode = openLocationCode.encode(midpoint.lat, midpoint.lon, 10);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "midpoint",
      message: "Calculated the geographic midpoint between the two points.",
      data: {
        from: formatCoordinate(from),
        to: formatCoordinate(to),
        midpoint: formatCoordinate(midpoint),
        lat: midpoint.lat,
        lon: midpoint.lon,
        plusCode,
      },
    };
  }

  async plusCodeEncode(input: GeoPlusCodeEncodeInput): Promise<AdapterActionResult> {
    const lat = normalizeLatitude(input.lat);
    const lon = normalizeLongitude(input.lon);
    const length = normalizeCodeLength(input.length);
    const code = openLocationCode.encode(lat, lon, length);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "pluscode-encode",
      message: `Encoded ${lat}, ${lon} into plus code ${code}.`,
      data: {
        lat,
        lon,
        codeLength: length,
        plusCode: code,
      },
    };
  }

  async plusCodeDecode(input: GeoPlusCodeDecodeInput): Promise<AdapterActionResult> {
    const code = normalizePlusCode(input.code);
    if (!openLocationCode.isValid(code)) {
      throw new MikaCliError("PLUSCODE_INVALID", `Invalid plus code "${input.code}".`);
    }

    const decoded = openLocationCode.decode(code);
    const center = {
      lat: round(decoded.latitudeCenter, 8),
      lon: round(decoded.longitudeCenter, 8),
    };

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "pluscode-decode",
      message: `Decoded plus code ${code}.`,
      data: {
        plusCode: code,
        codeLength: decoded.codeLength,
        center: formatCoordinate(center),
        latitudeCenter: center.lat,
        longitudeCenter: center.lon,
        latitudeLo: round(decoded.latitudeLo, 8),
        latitudeHi: round(decoded.latitudeHi, 8),
        longitudeLo: round(decoded.longitudeLo, 8),
        longitudeHi: round(decoded.longitudeHi, 8),
      },
    };
  }

  async elevation(input: GeoElevationInput): Promise<AdapterActionResult> {
    const lat = normalizeLatitude(input.lat);
    const lon = normalizeLongitude(input.lon);
    const dataset = normalizeElevationDataset(input.dataset);
    const url = new URL(`https://api.opentopodata.org/v1/${dataset}`);
    url.searchParams.set("locations", `${lat},${lon}`);

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
      throw new MikaCliError("GEO_ELEVATION_REQUEST_FAILED", "Unable to reach the public elevation service.", {
        cause: error,
        details: {
          url: url.toString(),
        },
      });
    }

    if (!response.ok) {
      throw new MikaCliError("GEO_ELEVATION_REQUEST_FAILED", `Elevation request failed with ${response.status} ${response.statusText}.`, {
        details: {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{
        elevation?: number | null;
        dataset?: string;
        location?: { lat?: number; lng?: number };
      }>;
    };
    const result = Array.isArray(payload.results) ? payload.results[0] : undefined;
    if (!result || typeof result.elevation !== "number") {
      throw new MikaCliError("GEO_ELEVATION_NOT_FOUND", "The public elevation service did not return an elevation for that coordinate.", {
        details: {
          dataset,
          url: url.toString(),
          status: payload.status ?? null,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "elevation",
      message: `Loaded elevation ${result.elevation}m for ${lat}, ${lon}.`,
      url: url.toString(),
      data: {
        lat,
        lon,
        dataset: result.dataset ?? dataset,
        elevationMeters: result.elevation,
        service: "opentopodata",
      },
    };
  }
}

export const geoAdapter = new GeoAdapter();

function parseLatLon(value: string, label: "from" | "to"): Coordinate {
  const parts = value.trim().split(",").map((part) => part.trim());
  if (parts.length !== 2) {
    throw new MikaCliError("GEO_COORDINATES_INVALID", `Invalid ${label} coordinates "${value}". Use "lat,lon".`);
  }

  return {
    lat: normalizeLatitude(parts[0] ?? ""),
    lon: normalizeLongitude(parts[1] ?? ""),
  };
}

function normalizeLatitude(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
    throw new MikaCliError("GEO_COORDINATES_INVALID", `Invalid latitude "${value}".`);
  }

  return round(parsed, 8);
}

function normalizeLongitude(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
    throw new MikaCliError("GEO_COORDINATES_INVALID", `Invalid longitude "${value}".`);
  }

  return round(parsed, 8);
}

function normalizeUnit(value?: string): DistanceUnit {
  const normalized = (value ?? "km").trim().toLowerCase();
  if (normalized === "km" || normalized === "miles" || normalized === "meters") {
    return normalized;
  }

  throw new MikaCliError("GEO_UNIT_INVALID", `Invalid unit "${value}". Use km, miles, or meters.`);
}

function normalizeCodeLength(value?: number): number {
  const length = value ?? 10;
  if (!Number.isFinite(length) || length < 6 || length > 15) {
    throw new MikaCliError("PLUSCODE_LENGTH_INVALID", `Invalid plus code length "${value}". Use an integer between 6 and 15.`);
  }

  return Math.floor(length);
}

function normalizePlusCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    throw new MikaCliError("PLUSCODE_REQUIRED", "Plus code cannot be empty.");
  }

  return normalized;
}

function normalizeElevationDataset(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() || "mapzen";
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new MikaCliError("GEO_ELEVATION_DATASET_INVALID", `Invalid elevation dataset "${value}".`);
  }

  return normalized;
}

function haversineDistanceMeters(from: Coordinate, to: Coordinate): number {
  const earthRadiusMeters = 6371008.8;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function sphericalMidpoint(from: Coordinate, to: Coordinate): Coordinate {
  const lat1 = toRadians(from.lat);
  const lon1 = toRadians(from.lon);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const bx = Math.cos(lat2) * Math.cos(deltaLon);
  const by = Math.cos(lat2) * Math.sin(deltaLon);
  const lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2));
  const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);

  return {
    lat: round(toDegrees(lat3), 8),
    lon: round(normalizeWrappedLongitude(toDegrees(lon3)), 8),
  };
}

function convertDistance(distanceMeters: number, unit: DistanceUnit): number {
  switch (unit) {
    case "meters":
      return round(distanceMeters, 2);
    case "miles":
      return round(distanceMeters / 1609.344, 4);
    case "km":
    default:
      return round(distanceMeters / 1000, 4);
  }
}

function formatCoordinate(value: Coordinate): string {
  return `${value.lat},${value.lon}`;
}

function normalizeWrappedLongitude(value: number): number {
  let result = value;
  while (result < -180) {
    result += 360;
  }
  while (result > 180) {
    result -= 360;
  }
  return result;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function round(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

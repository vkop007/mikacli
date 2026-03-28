import openLocationCodeModule from "open-location-code";

import { AutoCliError } from "../../../errors.js";

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
      throw new AutoCliError("PLUSCODE_INVALID", `Invalid plus code "${input.code}".`);
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
}

export const geoAdapter = new GeoAdapter();

function parseLatLon(value: string, label: "from" | "to"): Coordinate {
  const parts = value.trim().split(",").map((part) => part.trim());
  if (parts.length !== 2) {
    throw new AutoCliError("GEO_COORDINATES_INVALID", `Invalid ${label} coordinates "${value}". Use "lat,lon".`);
  }

  return {
    lat: normalizeLatitude(parts[0] ?? ""),
    lon: normalizeLongitude(parts[1] ?? ""),
  };
}

function normalizeLatitude(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
    throw new AutoCliError("GEO_COORDINATES_INVALID", `Invalid latitude "${value}".`);
  }

  return round(parsed, 8);
}

function normalizeLongitude(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
    throw new AutoCliError("GEO_COORDINATES_INVALID", `Invalid longitude "${value}".`);
  }

  return round(parsed, 8);
}

function normalizeUnit(value?: string): DistanceUnit {
  const normalized = (value ?? "km").trim().toLowerCase();
  if (normalized === "km" || normalized === "miles" || normalized === "meters") {
    return normalized;
  }

  throw new AutoCliError("GEO_UNIT_INVALID", `Invalid unit "${value}". Use km, miles, or meters.`);
}

function normalizeCodeLength(value?: number): number {
  const length = value ?? 10;
  if (!Number.isFinite(length) || length < 6 || length > 15) {
    throw new AutoCliError("PLUSCODE_LENGTH_INVALID", `Invalid plus code length "${value}". Use an integer between 6 and 15.`);
  }

  return Math.floor(length);
}

function normalizePlusCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    throw new AutoCliError("PLUSCODE_REQUIRED", "Plus code cannot be empty.");
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

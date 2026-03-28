import { AutoCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type OsrmRouteInput = {
  from: string;
  to: string;
  profile?: string;
  steps?: boolean;
};

type OsrmTableInput = {
  coordinates: string[];
  profile?: string;
  annotations?: string;
  sources?: string;
  destinations?: string;
};

type OsrmNearestInput = {
  coordinate: string;
  profile?: string;
  number?: number;
};

type OsrmTripInput = {
  coordinates: string[];
  profile?: string;
  source?: string;
  destination?: string;
  roundtrip?: boolean;
  steps?: boolean;
};

type OsrmMatchInput = {
  coordinates: string[];
  profile?: string;
  timestamps?: string;
  radiuses?: string;
  steps?: boolean;
  overview?: string;
};

type OsrmProfile = "driving" | "walking" | "cycling";

interface OsrmWaypoint {
  name?: string;
  location?: [number, number];
}

interface OsrmRouteResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    weight?: number;
    legs?: Array<{
      distance?: number;
      duration?: number;
      summary?: string;
      steps?: unknown[];
    }>;
  }>;
  waypoints?: OsrmWaypoint[];
  message?: string;
}

interface OsrmTableResponse {
  code?: string;
  distances?: Array<Array<number | null>>;
  durations?: Array<Array<number | null>>;
  sources?: Array<OsrmWaypoint & { distance?: number }>;
  destinations?: Array<OsrmWaypoint & { distance?: number }>;
  message?: string;
}

interface OsrmNearestResponse {
  code?: string;
  waypoints?: Array<OsrmWaypoint & { nodes?: number[]; distance?: number }>;
  message?: string;
}

interface OsrmTripResponse {
  code?: string;
  trips?: Array<{
    distance?: number;
    duration?: number;
    weight?: number;
    legs?: Array<{
      distance?: number;
      duration?: number;
      summary?: string;
      steps?: unknown[];
    }>;
  }>;
  waypoints?: Array<{
    waypoint_index?: number;
    trips_index?: number;
    distance?: number;
    name?: string;
    location?: [number, number];
  }>;
  message?: string;
}

interface OsrmMatchResponse {
  code?: string;
  matchings?: Array<{
    distance?: number;
    duration?: number;
    weight?: number;
    confidence?: number;
    legs?: Array<{
      distance?: number;
      duration?: number;
      summary?: string;
      steps?: unknown[];
    }>;
  }>;
  tracepoints?: Array<{
    matchings_index?: number;
    waypoint_index?: number;
    location?: [number, number];
    name?: string;
    distance?: number;
    alternatives_count?: number;
  } | null>;
  message?: string;
}

const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_USER_AGENT = "AutoCLI/1.0 (+https://github.com/)";

export class OsrmAdapter {
  readonly platform: Platform = "osrm" as Platform;
  readonly displayName = "OSRM";

  async route(input: OsrmRouteInput): Promise<AdapterActionResult> {
    const from = parseLatLon(input.from, "from");
    const to = parseLatLon(input.to, "to");
    const profile = normalizeProfile(input.profile);
    const includeSteps = Boolean(input.steps);
    const url = new URL(`/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}`, OSRM_BASE_URL);
    url.searchParams.set("overview", "false");
    url.searchParams.set("steps", includeSteps ? "true" : "false");

    const payload = await fetchOsrmJson<OsrmRouteResponse>(url, "OSRM_ROUTE_FAILED");
    if (payload.code !== "Ok") {
      throw new AutoCliError("OSRM_ROUTE_FAILED", payload.message ?? "OSRM could not build a route for those coordinates.", {
        details: {
          url: url.toString(),
          code: payload.code,
        },
      });
    }

    const route = payload.routes?.[0];
    if (!route) {
      throw new AutoCliError("OSRM_ROUTE_FAILED", "OSRM did not return any route.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "route",
      message: `Built a ${profile} route of ${formatKilometers(route.distance)} km in about ${formatMinutes(route.duration)} minutes.`,
      url: url.toString(),
      data: {
        route: {
          profile,
          from: `${from.lat},${from.lon}`,
          to: `${to.lat},${to.lon}`,
          distanceMeters: normalizeNumber(route.distance),
          distanceKm: formatKilometers(route.distance),
          durationSeconds: normalizeNumber(route.duration),
          durationMinutes: formatMinutes(route.duration),
          weight: normalizeNumber(route.weight),
          waypoints: normalizeWaypoints(payload.waypoints),
          stepsIncluded: includeSteps,
          url: url.toString(),
        },
      },
    };
  }

  async table(input: OsrmTableInput): Promise<AdapterActionResult> {
    const coordinates = parseCoordinateList(input.coordinates);
    const profile = normalizeProfile(input.profile);
    const url = buildOsrmUrl("table", profile, coordinates);
    url.searchParams.set("annotations", normalizeAnnotations(input.annotations));
    maybeSetParam(url, "sources", input.sources);
    maybeSetParam(url, "destinations", input.destinations);

    const payload = await fetchOsrmJson<OsrmTableResponse>(url, "OSRM_TABLE_FAILED");
    if (payload.code !== "Ok") {
      throw osrmError("OSRM_TABLE_FAILED", payload.message ?? "OSRM could not build a distance table.", url, payload.code);
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "table",
      message: `Built an OSRM ${profile} table for ${coordinates.length} point${coordinates.length === 1 ? "" : "s"}.`,
      url: url.toString(),
      data: {
        table: {
          profile,
          coordinates: coordinates.map((coordinate, index) => ({
            index,
            lat: coordinate.lat,
            lon: coordinate.lon,
            value: coordinate.raw,
          })),
          annotations: normalizeAnnotations(input.annotations),
          sources: normalizeIndexInput(input.sources, coordinates.length),
          destinations: normalizeIndexInput(input.destinations, coordinates.length),
          distances: payload.distances ?? [],
          durations: payload.durations ?? [],
          sourceCount: payload.sources?.length ?? 0,
          destinationCount: payload.destinations?.length ?? 0,
          url: url.toString(),
        },
      },
    };
  }

  async nearest(input: OsrmNearestInput): Promise<AdapterActionResult> {
    const coordinate = parseCoordinatePair(input.coordinate, "coordinate");
    const profile = normalizeProfile(input.profile);
    const number = clampInteger(input.number ?? 1, 1, 5);
    const url = buildOsrmUrl("nearest", profile, [coordinate]);
    url.searchParams.set("number", String(number));

    const payload = await fetchOsrmJson<OsrmNearestResponse>(url, "OSRM_NEAREST_FAILED");
    if (payload.code !== "Ok") {
      throw osrmError("OSRM_NEAREST_FAILED", payload.message ?? "OSRM could not locate a nearby road segment.", url, payload.code);
    }

    const waypoints = normalizeWaypoints(payload.waypoints);
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "nearest",
      message: `Found ${waypoints.length} OSRM nearest waypoint${waypoints.length === 1 ? "" : "s"}.`,
      url: url.toString(),
      data: {
        nearest: {
          profile,
          coordinate: coordinate.raw,
          number,
          waypoints,
          url: url.toString(),
        },
      },
    };
  }

  async trip(input: OsrmTripInput): Promise<AdapterActionResult> {
    const coordinates = parseCoordinateList(input.coordinates);
    const profile = normalizeProfile(input.profile);
    const url = buildOsrmUrl("trip", profile, coordinates);
    maybeSetParam(url, "source", input.source);
    maybeSetParam(url, "destination", input.destination);
    url.searchParams.set("roundtrip", String(input.roundtrip ?? true));
    url.searchParams.set("overview", "false");
    url.searchParams.set("steps", String(Boolean(input.steps)));

    const payload = await fetchOsrmJson<OsrmTripResponse>(url, "OSRM_TRIP_FAILED");
    if (payload.code !== "Ok") {
      throw osrmError("OSRM_TRIP_FAILED", payload.message ?? "OSRM could not optimize a trip for those coordinates.", url, payload.code);
    }

    const trip = payload.trips?.[0];
    if (!trip) {
      throw osrmError("OSRM_TRIP_FAILED", "OSRM did not return any trip.", url, payload.code);
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "trip",
      message: `Built an OSRM ${profile} trip for ${coordinates.length} point${coordinates.length === 1 ? "" : "s"}.`,
      url: url.toString(),
      data: {
        trip: {
          profile,
          coordinates: coordinates.map((coordinate, index) => ({
            index,
            lat: coordinate.lat,
            lon: coordinate.lon,
            value: coordinate.raw,
          })),
          source: input.source ?? "first",
          destination: input.destination ?? "last",
          roundtrip: input.roundtrip ?? true,
          distanceMeters: normalizeNumber(trip.distance),
          distanceKm: formatKilometers(trip.distance),
          durationSeconds: normalizeNumber(trip.duration),
          durationMinutes: formatMinutes(trip.duration),
          weight: normalizeNumber(trip.weight),
          waypointCount: payload.waypoints?.length ?? 0,
          waypoints: normalizeTripWaypoints(payload.waypoints),
          url: url.toString(),
        },
      },
    };
  }

  async match(input: OsrmMatchInput): Promise<AdapterActionResult> {
    const coordinates = parseCoordinateList(input.coordinates);
    const profile = normalizeProfile(input.profile);
    const url = buildOsrmUrl("match", profile, coordinates);
    url.searchParams.set("overview", normalizeOverview(input.overview));
    url.searchParams.set("steps", String(Boolean(input.steps)));
    maybeSetParam(url, "timestamps", normalizeDelimitedList(input.timestamps));
    maybeSetParam(url, "radiuses", normalizeDelimitedList(input.radiuses));

    const payload = await fetchOsrmJson<OsrmMatchResponse>(url, "OSRM_MATCH_FAILED");
    if (payload.code !== "Ok") {
      throw osrmError("OSRM_MATCH_FAILED", payload.message ?? "OSRM could not match that trace.", url, payload.code);
    }

    const matchings = normalizeMatchings(payload.matchings);
    const tracepoints = normalizeTracepoints(payload.tracepoints);
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "match",
      message: `Matched ${tracepoints.length} OSRM tracepoint${tracepoints.length === 1 ? "" : "s"}.`,
      url: url.toString(),
      data: {
        match: {
          profile,
          coordinates: coordinates.map((coordinate, index) => ({
            index,
            lat: coordinate.lat,
            lon: coordinate.lon,
            value: coordinate.raw,
          })),
          timestamps: normalizeDelimitedList(input.timestamps),
          radiuses: normalizeDelimitedList(input.radiuses),
          matchings,
          tracepoints,
          url: url.toString(),
        },
      },
    };
  }
}

export const osrmAdapter = new OsrmAdapter();

async function fetchOsrmJson<T>(url: URL, errorCode: string): Promise<T> {
  let response: Response;
  let responseText = "";

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        accept: "application/json",
        "user-agent": OSRM_USER_AGENT,
      },
    });
    responseText = await response.text();
  } catch (error) {
    throw new AutoCliError(errorCode, "Unable to reach the public OSRM routing service.", {
      cause: error,
      details: {
        url: url.toString(),
      },
    });
  }

  if (!response.ok) {
    throw buildOsrmRequestError(errorCode, url, response.status, response.statusText, responseText || undefined);
  }

  try {
    return JSON.parse(responseText) as T;
  } catch (error) {
    throw new AutoCliError("OSRM_RESPONSE_INVALID", "OSRM returned invalid JSON.", {
      cause: error,
      details: {
        url: url.toString(),
      },
    });
  }
}

function parseLatLon(value: string, label: "from" | "to"): { lat: number; lon: number } {
  return parseCoordinatePair(value, label);
}

function parseCoordinatePair(value: string, label: string): { lat: number; lon: number; raw: string } {
  const trimmed = value.trim();
  const parts = trimmed.split(",").map((part) => part.trim());
  if (parts.length !== 2) {
    throw new AutoCliError("OSRM_COORDINATES_INVALID", `Invalid ${label} coordinates "${value}". Use "lat,lon".`);
  }

  const lat = Number.parseFloat(parts[0] ?? "");
  const lon = Number.parseFloat(parts[1] ?? "");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new AutoCliError("OSRM_COORDINATES_INVALID", `Invalid ${label} coordinates "${value}". Use "lat,lon".`);
  }

  return {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    raw: `${Number(lat.toFixed(6))},${Number(lon.toFixed(6))}`,
  };
}

function normalizeProfile(value?: string): OsrmProfile {
  const normalized = (value ?? "driving").trim().toLowerCase();
  if (normalized === "driving" || normalized === "walking" || normalized === "cycling") {
    return normalized;
  }

  throw new AutoCliError("OSRM_PROFILE_INVALID", `Invalid OSRM profile "${value}". Use driving, walking, or cycling.`);
}

function normalizeAnnotations(value?: string): string {
  const normalized = (value ?? "distance,duration").trim();
  return normalized.length > 0 ? normalized : "distance,duration";
}

function normalizeOverview(value?: string): string {
  const normalized = (value ?? "false").trim().toLowerCase();
  return normalized === "full" || normalized === "simplified" ? normalized : "false";
}

function normalizeDelimitedList(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .split(/[;,]/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(";");

  return normalized.length > 0 ? normalized : undefined;
}

function parseCoordinateList(values: string[]): Array<{ lat: number; lon: number; raw: string }> {
  const flattened = values.flatMap((value) =>
    value
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  if (flattened.length < 2) {
    throw new AutoCliError("OSRM_COORDINATES_REQUIRED", "Provide at least two coordinates in \"lat,lon\" form.");
  }

  return flattened.map((entry, index) => parseCoordinatePair(entry, `coordinate ${index + 1}`));
}

function buildOsrmUrl(
  mode: "table" | "nearest" | "trip" | "match" | "route",
  profile: OsrmProfile,
  coordinates: Array<{ lat: number; lon: number }>,
): URL {
  const joined = coordinates.map((coordinate) => `${coordinate.lon},${coordinate.lat}`).join(";");
  return new URL(`/${mode}/v1/${profile}/${joined}`, OSRM_BASE_URL);
}

function maybeSetParam(url: URL, key: string, value: string | undefined): void {
  if (typeof value === "string" && value.trim().length > 0) {
    url.searchParams.set(key, value);
  }
}

function buildOsrmRequestError(errorCode: string, url: URL, status: number, statusText: string, body?: string): AutoCliError {
  return new AutoCliError(errorCode, `OSRM request failed with ${status} ${statusText}.`, {
    details: {
      url: url.toString(),
      status,
      statusText,
      body,
    },
  });
}

function osrmError(code: string, message: string, url: URL, upstreamCode?: string): AutoCliError {
  return new AutoCliError(code, message, {
    details: {
      url: url.toString(),
      code: upstreamCode,
    },
  });
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function normalizeIndexInput(value: string | undefined, total: number): string[] | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "all") {
    return Array.from({ length: total }, (_, index) => String(index));
  }

  const parts = normalized
    .split(/[;,]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : undefined;
}

function normalizeWaypoints(
  waypoints: Array<OsrmWaypoint & { nodes?: number[]; distance?: number }> | undefined,
): Array<Record<string, unknown>> {
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    return [];
  }

  return waypoints.map((waypoint, index) => ({
    index,
    name: waypoint.name?.trim() || undefined,
    lat: Array.isArray(waypoint.location) ? waypoint.location[1] : undefined,
    lon: Array.isArray(waypoint.location) ? waypoint.location[0] : undefined,
    distance: normalizeNumber(waypoint.distance),
    nodes: Array.isArray(waypoint.nodes) ? waypoint.nodes : undefined,
  }));
}

function normalizeTripWaypoints(
  waypoints: OsrmTripResponse["waypoints"] | undefined,
): Array<Record<string, unknown>> {
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    return [];
  }

  return waypoints.map((waypoint, index) => ({
    index,
    waypointIndex: waypoint.waypoint_index,
    tripsIndex: waypoint.trips_index,
    name: waypoint.name?.trim() || undefined,
    lat: Array.isArray(waypoint.location) ? waypoint.location[1] : undefined,
    lon: Array.isArray(waypoint.location) ? waypoint.location[0] : undefined,
    distance: normalizeNumber(waypoint.distance),
  }));
}

function normalizeMatchings(matchings: OsrmMatchResponse["matchings"] | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(matchings) || matchings.length === 0) {
    return [];
  }

  return matchings.map((matching, index) => ({
    index,
    distanceMeters: normalizeNumber(matching.distance),
    distanceKm: formatKilometers(matching.distance),
    durationSeconds: normalizeNumber(matching.duration),
    durationMinutes: formatMinutes(matching.duration),
    weight: normalizeNumber(matching.weight),
    confidence: normalizeNumber(matching.confidence),
    legCount: matching.legs?.length ?? 0,
  }));
}

function normalizeTracepoints(tracepoints: OsrmMatchResponse["tracepoints"] | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(tracepoints) || tracepoints.length === 0) {
    return [];
  }

  return tracepoints.map((tracepoint, index) => {
    if (!tracepoint) {
      return {
        index,
        matched: false,
      };
    }

    return {
      index,
      matched: true,
      matchingsIndex: tracepoint.matchings_index,
      waypointIndex: tracepoint.waypoint_index,
      name: tracepoint.name?.trim() || undefined,
      lat: Array.isArray(tracepoint.location) ? tracepoint.location[1] : undefined,
      lon: Array.isArray(tracepoint.location) ? tracepoint.location[0] : undefined,
      distance: normalizeNumber(tracepoint.distance),
      alternativesCount: tracepoint.alternatives_count,
    };
  });
}

function formatKilometers(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Number(((value ?? 0) / 1000).toFixed(2));
}

function formatMinutes(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Number(((value ?? 0) / 60).toFixed(1));
}

function normalizeNumber(value: number | undefined): number | undefined {
  return Number.isFinite(value) ? Number(value) : undefined;
}

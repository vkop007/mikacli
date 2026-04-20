import { MikaCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type OpenStreetMapSearchInput = {
  query: string;
  limit?: number;
};

type OpenStreetMapDetailsInput = {
  target: string;
};

type OpenStreetMapReverseInput = {
  lat: string | number;
  lon: string | number;
  zoom?: number;
};

type OpenStreetMapBboxInput = {
  bbox: string;
  query: string;
  limit?: number;
};

type OpenStreetMapNearbyInput = {
  lat: string | number;
  lon: string | number;
  query?: string;
  radius?: number;
  limit?: number;
};

type NominatimPlace = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  importance?: number;
  addresstype?: string;
  name?: string;
  display_name?: string;
};

type OverpassElement = {
  type?: "node" | "way" | "relation";
  id?: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = "MikaCLI/1.0 (+https://github.com/)";

export class OpenStreetMapAdapter {
  readonly platform: Platform = "openstreetmap" as Platform;
  readonly displayName = "OpenStreetMap";

  async search(input: OpenStreetMapSearchInput): Promise<AdapterActionResult> {
    const query = normalizeQuery(input.query);
    const limit = clampLimit(input.limit ?? 5, 1, 20);
    const url = buildNominatimSearchUrl({ query, limit });
    const payload = await fetchNominatimJson<Array<NominatimPlace>>(url);
    const items = payload.map((place) => toSearchItem(place)).filter(Boolean) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} OpenStreetMap place${items.length === 1 ? "" : "s"} for "${query}".`,
      url: url.toString(),
      data: {
        query,
        items,
      },
    };
  }

  async details(input: OpenStreetMapDetailsInput): Promise<AdapterActionResult> {
    const target = normalizeTarget(input.target);
    const { osmIds, label } = parseOsmTarget(target);
    const url = new URL("/lookup", NOMINATIM_BASE_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("osm_ids", osmIds);

    const payload = await fetchNominatimJson<Array<NominatimPlace>>(url);
    const place = payload[0];
    if (!place) {
      throw new MikaCliError("OPENSTREETMAP_NOT_FOUND", `No OpenStreetMap details were found for ${label}.`, {
        details: {
          target,
          osmIds,
        },
      });
    }

    const normalized = toPlaceRecord(place);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "details",
      message: `Loaded OpenStreetMap details for ${normalized.title}.`,
      id: normalized.id as string | undefined,
      url: url.toString(),
      data: {
        place: normalized,
      },
    };
  }

  async reverse(input: OpenStreetMapReverseInput): Promise<AdapterActionResult> {
    const lat = normalizeLatitude(input.lat);
    const lon = normalizeLongitude(input.lon);
    const zoom = clampZoom(input.zoom ?? 16);
    const url = new URL("/reverse", NOMINATIM_BASE_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", String(zoom));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");

    const place = await fetchNominatimJson<NominatimPlace>(url);
    const normalized = toPlaceRecord(place, zoom);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "reverse",
      message: `Resolved ${lat}, ${lon} with OpenStreetMap reverse geocoding.`,
      id: normalized.id as string | undefined,
      url: url.toString(),
      data: {
        place: normalized,
      },
    };
  }

  async bbox(input: OpenStreetMapBboxInput): Promise<AdapterActionResult> {
    const query = normalizeQuery(input.query);
    const limit = clampLimit(input.limit ?? 5, 1, 20);
    const box = parseBoundingBox(input.bbox);
    const url = buildNominatimSearchUrl({
      query,
      limit,
      viewbox: `${box.minLon},${box.maxLat},${box.maxLon},${box.minLat}`,
      bounded: true,
    });

    const payload = await fetchNominatimJson<Array<NominatimPlace>>(url);
    const items = payload.map((place) => toSearchItem(place)).filter(Boolean) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "bbox",
      message: `Loaded ${items.length} OpenStreetMap place${items.length === 1 ? "" : "s"} for "${query}" inside the requested bounding box.`,
      url: url.toString(),
      data: {
        query,
        bbox: box,
        items,
      },
    };
  }

  async nearby(input: OpenStreetMapNearbyInput): Promise<AdapterActionResult> {
    const lat = normalizeLatitude(input.lat);
    const lon = normalizeLongitude(input.lon);
    const limit = clampLimit(input.limit ?? 8, 1, 20);
    const radius = clampRadius(input.radius ?? 1000);
    const query = normalizeOptionalQuery(input.query);

    if (query) {
      return this.nearbySearch(lat, lon, query, radius, limit);
    }

    return this.nearbyOverpass(lat, lon, radius, limit);
  }

  private async nearbySearch(lat: number, lon: number, query: string, radius: number, limit: number): Promise<AdapterActionResult> {
    const box = buildRadiusBoundingBox(lat, lon, radius);
    const url = buildNominatimSearchUrl({
      query,
      limit,
      viewbox: `${box.minLon},${box.maxLat},${box.maxLon},${box.minLat}`,
      bounded: true,
    });

    const payload = await fetchNominatimJson<Array<NominatimPlace>>(url);
    const items = payload
      .map((place) => toSearchItem(place, { lat, lon }))
      .filter(Boolean) as Array<Record<string, unknown>>;
    items.sort((left, right) => compareOptionalNumbers(left.distance, right.distance));
    const visibleItems = items.slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "nearby",
      message: `Loaded ${visibleItems.length} OpenStreetMap place${visibleItems.length === 1 ? "" : "s"} near ${lat}, ${lon} for "${query}".`,
      url: url.toString(),
      data: {
        query,
        center: { lat, lon },
        radius,
        mode: "nominatim",
        totalFound: items.length,
        items: visibleItems,
      },
    };
  }

  private async nearbyOverpass(lat: number, lon: number, radius: number, limit: number): Promise<AdapterActionResult> {
    const url = buildOverpassNearbyUrl(lat, lon, radius);
    const payload = await fetchOverpassJson(url);
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    const items = elements
      .map((element) => toOverpassItem(element, lat, lon))
      .filter(Boolean) as Array<Record<string, unknown>>;
    items.sort((left, right) => compareOptionalNumbers(left.distance, right.distance));
    const visibleItems = items.slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "nearby",
      message: `Loaded ${visibleItems.length} nearby OpenStreetMap place${visibleItems.length === 1 ? "" : "s"} around ${lat}, ${lon}.`,
      url: url.toString(),
      data: {
        center: { lat, lon },
        radius,
        mode: "overpass",
        totalFound: items.length,
        items: visibleItems,
      },
    };
  }
}

export const openStreetMapAdapter = new OpenStreetMapAdapter();

async function fetchNominatimJson<T>(url: URL): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": NOMINATIM_USER_AGENT,
      },
    });
  } catch (error) {
    throw new MikaCliError("OPENSTREETMAP_REQUEST_FAILED", "Unable to reach the OpenStreetMap geocoding service.", {
      cause: error,
      details: {
        url: url.toString(),
      },
    });
  }

  if (!response.ok) {
    throw new MikaCliError("OPENSTREETMAP_REQUEST_FAILED", `OpenStreetMap request failed with ${response.status} ${response.statusText}.`, {
      details: {
        url: url.toString(),
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new MikaCliError("OPENSTREETMAP_RESPONSE_INVALID", "OpenStreetMap returned invalid JSON.", {
      cause: error,
      details: {
        url: url.toString(),
      },
    });
  }
}

async function fetchOverpassJson(url: URL): Promise<{ elements?: OverpassElement[] }> {
  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(25000),
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": NOMINATIM_USER_AGENT,
      },
    });
  } catch (error) {
    throw new MikaCliError("OPENSTREETMAP_NEARBY_FAILED", "Unable to reach the public Overpass service.", {
      cause: error,
      details: {
        url: url.toString(),
      },
    });
  }

  if (!response.ok) {
    throw new MikaCliError("OPENSTREETMAP_NEARBY_FAILED", `Overpass request failed with ${response.status} ${response.statusText}.`, {
      details: {
        url: url.toString(),
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  try {
    return (await response.json()) as { elements?: OverpassElement[] };
  } catch (error) {
    throw new MikaCliError("OPENSTREETMAP_RESPONSE_INVALID", "Overpass returned invalid JSON.", {
      cause: error,
      details: {
        url: url.toString(),
      },
    });
  }
}

function toSearchItem(place: NominatimPlace, center?: { lat: number; lon: number }): Record<string, unknown> | undefined {
  const normalized = toPlaceRecord(place, undefined, center);
  if (typeof normalized.title !== "string" || typeof normalized.id !== "string") {
    return undefined;
  }

  return normalized;
}

function toPlaceRecord(place: NominatimPlace, zoom?: number, center?: { lat: number; lon: number }): Record<string, unknown> {
  const title = normalizeString(place.name) ?? normalizeDisplayTitle(place.display_name) ?? "Untitled place";
  const location = normalizeString(place.display_name);
  const osmType = normalizeString(place.osm_type);
  const osmId = typeof place.osm_id === "number" ? String(place.osm_id) : undefined;
  const latitude = parseCoordinate(place.lat);
  const longitude = parseCoordinate(place.lon);
  const distance = latitude !== undefined && longitude !== undefined && center ? haversineMeters(center.lat, center.lon, latitude, longitude) : undefined;

  return {
    id: osmType && osmId ? `${osmType}/${osmId}` : typeof place.place_id === "number" ? String(place.place_id) : undefined,
    title,
    category: normalizeString(place.category),
    type: [normalizeString(place.category), normalizeString(place.type)].filter(Boolean).join(":") || normalizeString(place.addresstype) || "place",
    location,
    lat: latitude,
    lon: longitude,
    latitude,
    longitude,
    distance: distance !== undefined ? Number(distance.toFixed(0)) : undefined,
    importance: typeof place.importance === "number" ? Number(place.importance.toFixed(4)) : undefined,
    osmType,
    osmId,
    zoom,
    url: osmType && osmId ? `https://www.openstreetmap.org/${osmType}/${osmId}` : undefined,
  };
}

function normalizeQuery(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MikaCliError("OPENSTREETMAP_QUERY_REQUIRED", "Place search query cannot be empty.");
  }

  return normalized;
}

function normalizeTarget(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MikaCliError("OPENSTREETMAP_TARGET_REQUIRED", "Provide an OpenStreetMap node, way, relation, or OSM URL.");
  }

  return normalized;
}

function normalizeLatitude(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
    throw new MikaCliError("OPENSTREETMAP_COORDINATES_INVALID", `Invalid latitude "${value}".`);
  }

  return Number(parsed.toFixed(6));
}

function normalizeLongitude(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
    throw new MikaCliError("OPENSTREETMAP_COORDINATES_INVALID", `Invalid longitude "${value}".`);
  }

  return Number(parsed.toFixed(6));
}

function clampLimit(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clampZoom(value: number): number {
  return clampLimit(value, 0, 18);
}

function clampRadius(value: number): number {
  return clampLimit(value, 100, 5000);
}

function parseCoordinate(value: string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(6)) : undefined;
}

function normalizeString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeDisplayTitle(displayName: string | undefined): string | undefined {
  const value = normalizeString(displayName);
  if (!value) {
    return undefined;
  }

  return value.split(",")[0]?.trim() || value;
}

function normalizeOptionalQuery(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function parseBoundingBox(value: string): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 4) {
    throw new MikaCliError("OPENSTREETMAP_BBOX_INVALID", `Invalid bounding box "${value}". Expected "minLon,minLat,maxLon,maxLat".`);
  }

  const minLon = Number.parseFloat(parts[0] ?? "");
  const minLat = Number.parseFloat(parts[1] ?? "");
  const maxLon = Number.parseFloat(parts[2] ?? "");
  const maxLat = Number.parseFloat(parts[3] ?? "");
  if ([minLon, minLat, maxLon, maxLat].some((entry) => !Number.isFinite(entry))) {
    throw new MikaCliError("OPENSTREETMAP_BBOX_INVALID", `Invalid bounding box "${value}". Expected four numbers.`);
  }

  if (minLon >= maxLon || minLat >= maxLat) {
    throw new MikaCliError("OPENSTREETMAP_BBOX_INVALID", `Invalid bounding box "${value}". Ensure min values are smaller than max values.`);
  }

  return {
    minLon: Number(minLon.toFixed(6)),
    minLat: Number(minLat.toFixed(6)),
    maxLon: Number(maxLon.toFixed(6)),
    maxLat: Number(maxLat.toFixed(6)),
  };
}

function buildNominatimSearchUrl(input: {
  query: string;
  limit: number;
  viewbox?: string;
  bounded?: boolean;
}): URL {
  const url = new URL("/search", NOMINATIM_BASE_URL);
  url.searchParams.set("q", input.query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(input.limit));
  if (input.viewbox) {
    url.searchParams.set("viewbox", input.viewbox);
  }
  if (input.bounded) {
    url.searchParams.set("bounded", "1");
  }

  return url;
}

function buildRadiusBoundingBox(lat: number, lon: number, radiusMeters: number): {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
} {
  const latRadians = (lat * Math.PI) / 180;
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.max(0.01, Math.cos(latRadians)));

  return {
    minLat: clampCoordinate(lat - latDelta, -90, 90),
    maxLat: clampCoordinate(lat + latDelta, -90, 90),
    minLon: clampCoordinate(lon - lonDelta, -180, 180),
    maxLon: clampCoordinate(lon + lonDelta, -180, 180),
  };
}

function buildOverpassNearbyUrl(lat: number, lon: number, radiusMeters: number): URL {
  const query = `
[out:json][timeout:25];
(
  nwr(around:${radiusMeters},${lat},${lon})["name"];
  nwr(around:${radiusMeters},${lat},${lon})["amenity"];
  nwr(around:${radiusMeters},${lat},${lon})["shop"];
  nwr(around:${radiusMeters},${lat},${lon})["tourism"];
  nwr(around:${radiusMeters},${lat},${lon})["leisure"];
  nwr(around:${radiusMeters},${lat},${lon})["office"];
  nwr(around:${radiusMeters},${lat},${lon})["historic"];
  nwr(around:${radiusMeters},${lat},${lon})["railway"];
);
out center;
`.trim();
  const url = new URL("https://overpass-api.de/api/interpreter");
  url.searchParams.set("data", query);
  return url;
}

function toOverpassItem(element: OverpassElement, centerLat: number, centerLon: number): Record<string, unknown> | undefined {
  const type = element.type;
  const id = element.id;
  const tags = element.tags ?? {};
  if (!type || typeof id !== "number") {
    return undefined;
  }

  const latitude = normalizeOptionalNumber(element.lat ?? element.center?.lat);
  const longitude = normalizeOptionalNumber(element.lon ?? element.center?.lon);
  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }

  const title =
    normalizeString(tags.name) ??
    normalizeString(tags.brand) ??
    normalizeString(tags.operator) ??
    normalizeString(tags.ref) ??
    [tags.amenity, tags.shop, tags.tourism, tags.leisure, tags.office, tags.historic, tags.railway].find((entry) => typeof entry === "string" && entry.trim().length > 0) ??
    `${type}/${id}`;
  const summary = buildTagsSummary(tags);
  const location = buildLocationSummary(tags);
  const distance = haversineMeters(centerLat, centerLon, latitude, longitude);
  const placeType = buildPlaceType(tags);

  return {
    id: `${type}/${id}`,
    title,
    type: placeType,
    location,
    lat: Number(latitude.toFixed(6)),
    lon: Number(longitude.toFixed(6)),
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    distance: Number(distance.toFixed(0)),
    osmType: type,
    osmId: String(id),
    importance: tags.rating ? Number.parseFloat(tags.rating) : undefined,
    summary,
    url: `https://www.openstreetmap.org/${type}/${id}`,
    category: tags.amenity ?? tags.shop ?? tags.tourism ?? tags.leisure ?? tags.office ?? tags.historic ?? tags.railway,
  };
}

function buildPlaceType(tags: Record<string, string>): string {
  const pairs = [
    ["amenity", tags.amenity],
    ["shop", tags.shop],
    ["tourism", tags.tourism],
    ["leisure", tags.leisure],
    ["office", tags.office],
    ["historic", tags.historic],
    ["railway", tags.railway],
  ] as const;

  const found = pairs.find(([, value]) => typeof value === "string" && value.trim().length > 0);
  if (found) {
    return `${found[0]}:${found[1]}`;
  }

  return "place";
}

function buildLocationSummary(tags: Record<string, string>): string | undefined {
  const parts = [
    tags["addr:full"],
    tags["addr:housename"],
    tags["addr:housenumber"] && tags["addr:street"] ? `${tags["addr:housenumber"]} ${tags["addr:street"]}` : undefined,
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:country"],
  ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);

  if (parts.length === 0) {
    return undefined;
  }

  return Array.from(new Set(parts.map((part) => part.trim()))).join(", ");
}

function buildTagsSummary(tags: Record<string, string>): string | undefined {
  const items = [
    tags.amenity,
    tags.shop,
    tags.tourism,
    tags.leisure,
    tags.office,
    tags.historic,
    tags.railway,
    tags.cuisine && `cuisine:${tags.cuisine}`,
    tags.website && `website:${tags.website}`,
    tags.opening_hours && `hours:${tags.opening_hours}`,
  ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);

  if (items.length === 0) {
    return undefined;
  }

  return items.slice(0, 4).join(", ");
}

function normalizeOptionalNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compareOptionalNumbers(left: unknown, right: unknown): number {
  const leftValue = typeof left === "number" && Number.isFinite(left) ? left : Number.POSITIVE_INFINITY;
  const rightValue = typeof right === "number" && Number.isFinite(right) ? right : Number.POSITIVE_INFINITY;
  return leftValue - rightValue;
}

function clampCoordinate(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(value.toFixed(6))));
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degree: number): number => (degree * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseOsmTarget(target: string): { osmIds: string; label: string } {
  const normalized = target.trim();
  if (!normalized) {
    throw new MikaCliError("OPENSTREETMAP_TARGET_REQUIRED", "Provide an OpenStreetMap node, way, relation, or OSM URL.");
  }

  const fullUrl = normalized.match(/^https?:\/\/(?:www\.)?openstreetmap\.org\/(node|way|relation)\/(\d+)(?:[/?#].*)?$/i);
  if (fullUrl) {
    const type = normalizeOsmType(fullUrl[1] ?? "");
    const id = fullUrl[2] ?? "";
    return {
      osmIds: `${type}${id}`,
      label: `${fullUrl[1]?.toLowerCase() ?? "osm"}/${id}`,
    };
  }

  const slashForm = normalized.match(/^(node|way|relation)\/(\d+)$/i);
  if (slashForm) {
    const type = normalizeOsmType(slashForm[1] ?? "");
    const id = slashForm[2] ?? "";
    return {
      osmIds: `${type}${id}`,
      label: `${slashForm[1]?.toLowerCase() ?? "osm"}/${id}`,
    };
  }

  const compactForm = normalized.match(/^([nwr])(\d+)$/i);
  if (compactForm) {
    const type = normalizeOsmType(compactForm[1] ?? "");
    const id = compactForm[2] ?? "";
    return {
      osmIds: `${type}${id}`,
      label: `${compactForm[1]?.toLowerCase() ?? "osm"}/${id}`,
    };
  }

  throw new MikaCliError("OPENSTREETMAP_TARGET_INVALID", `Invalid OpenStreetMap target "${target}". Use node/123, way/123, relation/123, or an openstreetmap.org URL.`);
}

function normalizeOsmType(value: string): "N" | "W" | "R" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "node" || normalized === "n") {
    return "N";
  }
  if (normalized === "way" || normalized === "w") {
    return "W";
  }
  if (normalized === "relation" || normalized === "r") {
    return "R";
  }

  throw new MikaCliError("OPENSTREETMAP_TARGET_INVALID", `Invalid OpenStreetMap element type "${value}".`);
}

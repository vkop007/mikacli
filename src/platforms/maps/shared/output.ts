import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printMapsSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? (result.data.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log("No places found.");
    return;
  }

  for (const item of items) {
    const title = asString(item.title) ?? "-";
    const id = asString(item.id) ?? "-";
    console.log(`${title} (${id})`);
    printField("type", item.type);
    printField("category", item.category);
    printField("location", item.location);
    printField("lat", item.latitude);
    printField("lon", item.longitude);
    printField("distance", item.distance);
    printField("importance", item.importance);
    printField("osmType", item.osmType);
    printField("osmId", item.osmId);
    printField("summary", item.summary);
    printField("url", item.url);
    console.log("");
  }
}

export function printMapsPlaceResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const place = toRecord(result.data?.place);
  for (const key of ["title", "type", "location", "lat", "lon", "importance", "osmType", "osmId", "zoom", "summary", "url"]) {
    printField(key, place[key]);
  }
}

export function printMapsRouteResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const route = toRecord(result.data?.route);
  for (const key of ["profile", "distanceKm", "durationMinutes", "from", "to", "waypoints", "url"]) {
    printField(key, route[key]);
  }
}

export function printMapsMatrixResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const table = toRecord(result.data?.table);
  printField("profile", table.profile);
  printField("coordinates", table.coordinates);
  printField("annotations", table.annotations);
  printField("sources", table.sources);
  printField("destinations", table.destinations);
  printField("distance rows", table.distances);
  printField("duration rows", table.durations);
}

export function printMapsNearestResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const nearest = toRecord(result.data?.nearest);
  printField("profile", nearest.profile);
  printField("coordinate", nearest.coordinate);
  printField("number", nearest.number);
  printField("waypoints", nearest.waypoints);
}

export function printMapsTripResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const trip = toRecord(result.data?.trip);
  printField("profile", trip.profile);
  printField("coordinates", trip.coordinates);
  printField("source", trip.source);
  printField("destination", trip.destination);
  printField("roundtrip", trip.roundtrip);
  printField("distanceKm", trip.distanceKm);
  printField("durationMinutes", trip.durationMinutes);
  printField("waypoints", trip.waypoints);
}

export function printMapsTraceResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const trace = toRecord(result.data?.match);
  printField("profile", trace.profile);
  printField("coordinates", trace.coordinates);
  printField("timestamps", trace.timestamps);
  printField("radiuses", trace.radiuses);
  printField("matchings", trace.matchings);
  printField("tracepoints", trace.tracepoints);
}

function printField(label: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return;
    }

    console.log(`${label}: ${value.map((entry) => formatValue(entry)).join(", ")}`);
    return;
  }

  console.log(`${label}: ${formatValue(value)}`);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

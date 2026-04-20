import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseMapsLimitOption, parseMapsZoomOption } from "../shared/options.js";
import { printMapsPlaceResult, printMapsSearchResult } from "../shared/output.js";
import { openStreetMapAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const openStreetMapPlatformDefinition: PlatformDefinition = {
  id: "openstreetmap",
  category: "maps",
  displayName: "OpenStreetMap",
  description: "Public place search, geocoding, reverse geocoding, bounding-box lookup, and nearby search through OpenStreetMap",
  aliases: ["nominatim"],
  authStrategies: ["none"],
  adapter: openStreetMapAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      aliases: ["geocode"],
      description: "Search for places or geocode a free-form query with OpenStreetMap",
      spinnerText: "Searching OpenStreetMap places...",
      successMessage: "OpenStreetMap search complete.",
      options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseMapsLimitOption }],
      action: ({ args, options }) =>
        openStreetMapAdapter.search({
          query: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMapsSearchResult,
    }),
    createAdapterActionCapability({
      id: "reverse",
      command: "reverse <lat> <lon>",
      description: "Reverse geocode latitude and longitude into an address-like place record",
      spinnerText: "Reverse geocoding with OpenStreetMap...",
      successMessage: "OpenStreetMap reverse geocoding complete.",
      options: [{ flags: "--zoom <number>", description: "Nominatim zoom level from 0 to 18 (default: 16)", parser: parseMapsZoomOption }],
      action: ({ args, options }) =>
        openStreetMapAdapter.reverse({
          lat: String(args[0] ?? ""),
          lon: String(args[1] ?? ""),
          zoom: options.zoom as number | undefined,
        }),
      onSuccess: printMapsPlaceResult,
    }),
    createAdapterActionCapability({
      id: "details",
      command: "details <target>",
      aliases: ["lookup", "info"],
      description: "Load OpenStreetMap details for a node, way, relation, or OpenStreetMap URL",
      spinnerText: "Loading OpenStreetMap details...",
      successMessage: "OpenStreetMap details loaded.",
      action: ({ args }) =>
        openStreetMapAdapter.details({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printMapsPlaceResult,
    }),
    createAdapterActionCapability({
      id: "bbox",
      command: "bbox <bbox> [query...]",
      aliases: ["bounds"],
      description: "Search for places inside a bounding box using minLon,minLat,maxLon,maxLat",
      spinnerText: "Searching OpenStreetMap inside bounding box...",
      successMessage: "OpenStreetMap bounding-box search complete.",
      options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseMapsLimitOption }],
      action: ({ args, options }) =>
        openStreetMapAdapter.bbox({
          bbox: String(args[0] ?? ""),
          query: args.slice(1).map((part) => String(part ?? "")).join(" "),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMapsSearchResult,
    }),
    createAdapterActionCapability({
      id: "nearby",
      command: "nearby <lat> <lon> [query...]",
      description: "Find nearby OpenStreetMap places around coordinates, with optional query text",
      spinnerText: "Searching nearby OpenStreetMap places...",
      successMessage: "OpenStreetMap nearby search complete.",
      options: [
        { flags: "--radius <meters>", description: "Search radius in meters (default: 1000)", parser: parseRadiusOption },
        { flags: "--limit <number>", description: "Maximum results to return (default: 8)", parser: parseMapsLimitOption },
      ],
      action: ({ args, options }) =>
        openStreetMapAdapter.nearby({
          lat: String(args[0] ?? ""),
          lon: String(args[1] ?? ""),
          query: args.slice(2).map((part) => String(part ?? "")).join(" "),
          radius: options.radius as number | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printMapsSearchResult,
    }),
  ],
  examples: [
    'mikacli openstreetmap search "Mumbai"',
    "mikacli openstreetmap search \"Bandra West Mumbai\" --limit 3",
    "mikacli openstreetmap reverse 19.0760 72.8777",
    'mikacli openstreetmap details node/16173235',
    'mikacli openstreetmap bbox "72.85,19.05,72.89,19.09" "cafe"',
    'mikacli openstreetmap nearby 19.0760 72.8777 "cafe" --radius 1000',
  ],
};

function parseRadiusOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

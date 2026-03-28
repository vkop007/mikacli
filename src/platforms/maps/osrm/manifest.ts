import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import {
  printMapsMatrixResult,
  printMapsNearestResult,
  printMapsRouteResult,
  printMapsTraceResult,
  printMapsTripResult,
} from "../shared/output.js";
import { osrmAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const osrmPlatformDefinition: PlatformDefinition = {
  id: "osrm",
  category: "maps",
  displayName: "OSRM",
  description: "Public route lookup through the Open Source Routing Machine demo service",
  authStrategies: ["none"],
  adapter: osrmAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "route",
      command: "route <from> <to>",
      description: 'Build a route between two coordinate pairs using "lat,lon" inputs',
      spinnerText: "Building route with OSRM...",
      successMessage: "OSRM route ready.",
      options: [
        { flags: "--profile <profile>", description: "Routing profile: driving, walking, or cycling" },
        { flags: "--steps", description: "Ask OSRM to include step metadata in the route calculation" },
      ],
      action: ({ args, options }) =>
        osrmAdapter.route({
          from: String(args[0] ?? ""),
          to: String(args[1] ?? ""),
          profile: options.profile as string | undefined,
          steps: Boolean(options.steps),
        }),
      onSuccess: printMapsRouteResult,
    }),
    createAdapterActionCapability({
      id: "table",
      command: "table <coordinates...>",
      description: "Build a travel-time and distance matrix for multiple coordinates",
      spinnerText: "Building OSRM table...",
      successMessage: "OSRM table ready.",
      options: [
        { flags: "--profile <profile>", description: "Routing profile: driving, walking, or cycling" },
        { flags: "--annotations <value>", description: "OSRM annotations, default distance,duration" },
        { flags: "--sources <value>", description: 'Source indexes or "all"' },
        { flags: "--destinations <value>", description: 'Destination indexes or "all"' },
      ],
      action: ({ args, options }) =>
        osrmAdapter.table({
          coordinates: normalizeVarargs(args),
          profile: options.profile as string | undefined,
          annotations: options.annotations as string | undefined,
          sources: options.sources as string | undefined,
          destinations: options.destinations as string | undefined,
        }),
      onSuccess: printMapsMatrixResult,
    }),
    createAdapterActionCapability({
      id: "nearest",
      command: "nearest <coordinate>",
      description: "Snap a coordinate to the nearest routable road segment",
      spinnerText: "Finding nearest OSRM waypoint...",
      successMessage: "OSRM nearest waypoint ready.",
      options: [
        { flags: "--profile <profile>", description: "Routing profile: driving, walking, or cycling" },
        { flags: "--number <number>", description: "Maximum nearest waypoints to return (default: 1)" },
      ],
      action: ({ args, options }) =>
        osrmAdapter.nearest({
          coordinate: String(args[0] ?? ""),
          profile: options.profile as string | undefined,
          number: options.number === undefined ? undefined : Number(options.number),
        }),
      onSuccess: printMapsNearestResult,
    }),
    createAdapterActionCapability({
      id: "trip",
      command: "trip <coordinates...>",
      description: "Optimize a trip across multiple coordinates using the OSRM demo service",
      spinnerText: "Optimizing OSRM trip...",
      successMessage: "OSRM trip ready.",
      options: [
        { flags: "--profile <profile>", description: "Routing profile: driving, walking, or cycling" },
        { flags: "--source <value>", description: 'Trip source mode like "first", "any", or "all"' },
        { flags: "--destination <value>", description: 'Trip destination mode like "last", "any", or "all"' },
        { flags: "--roundtrip", description: "Ask OSRM for a roundtrip route" },
        { flags: "--no-roundtrip", description: "Disable roundtrip optimization" },
        { flags: "--steps", description: "Ask OSRM to include step metadata in the route calculation" },
      ],
      action: ({ args, options }) =>
        osrmAdapter.trip({
          coordinates: normalizeVarargs(args),
          profile: options.profile as string | undefined,
          source: options.source as string | undefined,
          destination: options.destination as string | undefined,
          roundtrip: options.roundtrip as boolean | undefined,
          steps: Boolean(options.steps),
        }),
      onSuccess: printMapsTripResult,
    }),
    createAdapterActionCapability({
      id: "match",
      command: "match <coordinates...>",
      description: "Match a GPS trace onto roads using the OSRM demo service",
      spinnerText: "Matching OSRM trace...",
      successMessage: "OSRM trace matched.",
      options: [
        { flags: "--profile <profile>", description: "Routing profile: driving, walking, or cycling" },
        { flags: "--timestamps <list>", description: "Semicolon- or comma-separated timestamps list" },
        { flags: "--radiuses <list>", description: "Semicolon- or comma-separated radiuses list" },
        { flags: "--steps", description: "Ask OSRM to include step metadata in the route calculation" },
        { flags: "--overview <value>", description: "Overview mode: false, simplified, or full" },
      ],
      action: ({ args, options }) =>
        osrmAdapter.match({
          coordinates: normalizeVarargs(args),
          profile: options.profile as string | undefined,
          timestamps: options.timestamps as string | undefined,
          radiuses: options.radiuses as string | undefined,
          steps: Boolean(options.steps),
          overview: options.overview as string | undefined,
        }),
      onSuccess: printMapsTraceResult,
    }),
  ],
  examples: [
    'autocli osrm route "19.0760,72.8777" "28.6139,77.2090"',
    'autocli osrm route "19.0760,72.8777" "19.2183,72.9781" --profile driving',
    'autocli osrm table "19.0760,72.8777" "28.6139,77.2090" "19.2183,72.9781"',
    'autocli osrm nearest "19.0760,72.8777"',
    'autocli osrm trip "19.0760,72.8777" "28.6139,77.2090" "19.2183,72.9781"',
    'autocli osrm match "19.07596,72.87767" "19.07610,72.87780" "19.07622,72.87793"',
  ],
};

function normalizeVarargs(args: unknown[]): string[] {
  const first = args[0];
  if (Array.isArray(first)) {
    return first.map((value) => String(value));
  }

  return args.map((value) => String(value));
}

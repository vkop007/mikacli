import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { geoAdapter } from "./adapter.js";
import { printGeoResult } from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const geoPlatformDefinition: PlatformDefinition = {
  id: "geo",
  category: "maps",
  displayName: "Geo",
  description: "Local no-key coordinate utilities like distance, midpoint, and plus code conversion",
  authStrategies: ["none"],
  adapter: geoAdapter,
  capabilities: [
    createAdapterActionCapability({
      id: "distance",
      command: "distance <from> <to>",
      description: 'Calculate a haversine distance between two "lat,lon" points',
      spinnerText: "Calculating geographic distance...",
      successMessage: "Distance calculated.",
      options: [{ flags: "--unit <unit>", description: "Distance unit: km, miles, or meters" }],
      action: ({ args, options }) =>
        geoAdapter.distance({
          from: String(args[0] ?? ""),
          to: String(args[1] ?? ""),
          unit: options.unit as string | undefined,
        }),
      onSuccess: printGeoResult,
    }),
    createAdapterActionCapability({
      id: "midpoint",
      command: "midpoint <from> <to>",
      description: 'Calculate the geographic midpoint between two "lat,lon" points',
      spinnerText: "Calculating midpoint...",
      successMessage: "Midpoint calculated.",
      action: ({ args }) =>
        geoAdapter.midpoint({
          from: String(args[0] ?? ""),
          to: String(args[1] ?? ""),
        }),
      onSuccess: printGeoResult,
    }),
    createAdapterActionCapability({
      id: "pluscode-encode",
      command: "pluscode-encode <lat> <lon>",
      aliases: ["pluscode", "encode"],
      description: "Encode latitude and longitude into a plus code",
      spinnerText: "Encoding plus code...",
      successMessage: "Plus code encoded.",
      options: [{ flags: "--length <number>", description: "Code length between 6 and 15", parser: (value) => Number.parseInt(value, 10) }],
      action: ({ args, options }) =>
        geoAdapter.plusCodeEncode({
          lat: String(args[0] ?? ""),
          lon: String(args[1] ?? ""),
          length: options.length as number | undefined,
        }),
      onSuccess: printGeoResult,
    }),
    createAdapterActionCapability({
      id: "pluscode-decode",
      command: "pluscode-decode <code>",
      aliases: ["decode"],
      description: "Decode a plus code into its center coordinates and bounds",
      spinnerText: "Decoding plus code...",
      successMessage: "Plus code decoded.",
      action: ({ args }) =>
        geoAdapter.plusCodeDecode({
          code: String(args[0] ?? ""),
        }),
      onSuccess: printGeoResult,
    }),
  ],
  examples: [
    'autocli geo distance "19.0760,72.8777" "28.6139,77.2090"',
    'autocli geo midpoint "19.0760,72.8777" "28.6139,77.2090"',
    "autocli geo pluscode-encode 19.0760 72.8777 --length 10",
    "autocli geo pluscode-decode 7JWV3VGV+9X",
  ],
};

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { weatherAdapter, type WeatherAdapter } from "../adapter.js";
import { printWeatherResult } from "../output.js";

export function createWeatherLookupCapability(adapter: WeatherAdapter) {
  return createAdapterActionCapability({
    id: "weather",
    command: "weather [location]",
    description: "Get current conditions and short forecast from wttr.in",
    spinnerText: "Loading weather...",
    successMessage: "Weather loaded.",
    options: [
      { flags: "--days <number>", description: "Forecast days to include (1-3, default: 1)", parser: parseDayCount },
      { flags: "--lang <code>", description: "Response language code, for example en, es, fr, hi" },
    ],
    action: ({ args, options }) =>
      adapter.weather({
        location: args[0] ? String(args[0]) : undefined,
        days: options.days as number | undefined,
        lang: options.lang as string | undefined,
      }),
    onSuccess: printWeatherResult,
  });
}

export const weatherLookupCapability = createWeatherLookupCapability(weatherAdapter);

function parseDayCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3) {
    throw new Error(`Invalid day count "${value}". Expected an integer between 1 and 3.`);
  }

  return parsed;
}

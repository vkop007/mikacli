import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printWeatherResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const current = toRecord(result.data?.current);
  if (current) {
    const nowParts = [
      typeof current.condition === "string" ? current.condition : undefined,
      formatTemp(current.temperatureC),
      formatTemp(current.feelsLikeC, "feels"),
    ].filter((value): value is string => Boolean(value));

    if (nowParts.length > 0) {
      console.log(`Now: ${nowParts.join(" • ")}`);
    }

    const extras = [
      typeof current.humidityPercent === "number" ? `humidity ${Math.round(current.humidityPercent)}%` : undefined,
      typeof current.windKmph === "number"
        ? `wind ${Math.round(current.windKmph)} km/h${typeof current.windDirection === "string" ? ` ${current.windDirection}` : ""}`
        : undefined,
    ].filter((value): value is string => Boolean(value));

    if (extras.length > 0) {
      console.log(extras.join(" • "));
    }
  }

  const forecast = Array.isArray(result.data?.forecast) ? result.data.forecast : [];
  if (forecast.length === 0) {
    return;
  }

  console.log("\nForecast:");
  for (const rawDay of forecast) {
    const day = toRecord(rawDay);
    if (!day) {
      continue;
    }

    const label = typeof day.date === "string" ? day.date : "day";
    const parts = [
      typeof day.condition === "string" ? day.condition : undefined,
      formatRange(day.minTempC, day.maxTempC),
      typeof day.avgTempC === "number" ? `avg ${Math.round(day.avgTempC)}°C` : undefined,
    ].filter((value): value is string => Boolean(value));

    if (parts.length > 0) {
      console.log(`${label}: ${parts.join(" • ")}`);
    } else {
      console.log(label);
    }
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function formatTemp(value: unknown, prefix?: string): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const temp = `${Math.round(value)}°C`;
  return prefix ? `${prefix} ${temp}` : temp;
}

function formatRange(min: unknown, max: unknown): string | undefined {
  if (typeof min !== "number" || !Number.isFinite(min) || typeof max !== "number" || !Number.isFinite(max)) {
    return undefined;
  }

  return `${Math.round(min)}°C..${Math.round(max)}°C`;
}

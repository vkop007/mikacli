import { weatherAdapter, type WeatherAdapter } from "../adapter.js";
import { createWeatherLookupCapability } from "./weather.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createWeatherCapabilities(adapter: WeatherAdapter): readonly PlatformCapability[] {
  return [createWeatherLookupCapability(adapter)];
}

export const weatherCapabilities: readonly PlatformCapability[] = createWeatherCapabilities(weatherAdapter);

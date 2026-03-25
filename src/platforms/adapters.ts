import { getPlatformDefinitions } from "./index.js";

import type { PlatformAdapter } from "../types.js";
import type { PlatformName } from "./config.js";

export function getPlatformAdapter(platform: PlatformName): PlatformAdapter | undefined {
  return getPlatformDefinitions().find((definition) => definition.id === platform)?.adapter;
}

export function getPlatformAdapters(): PlatformAdapter[] {
  return getPlatformDefinitions()
    .map((definition) => definition.adapter)
    .filter((adapter): adapter is PlatformAdapter => typeof adapter !== "undefined");
}

import { InstagramAdapter } from "./instagram.js";
import { XAdapter } from "./x.js";

import type { Platform, PlatformAdapter } from "../types.js";

const registry: Record<Platform, PlatformAdapter> = {
  instagram: new InstagramAdapter(),
  x: new XAdapter(),
};

export function getAdapter(platform: Platform): PlatformAdapter {
  return registry[platform];
}

export function getAllAdapters(): PlatformAdapter[] {
  return Object.values(registry);
}

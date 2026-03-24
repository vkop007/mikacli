import { InstagramAdapter } from "./instagram.js";
import { LinkedInAdapter } from "./linkedin.js";
import { TikTokAdapter } from "./tiktok.js";
import { XAdapter } from "./x.js";
import { YouTubeAdapter } from "./youtube.js";

import type { Platform, PlatformAdapter } from "../types.js";

const registry: Record<Platform, PlatformAdapter> = {
  instagram: new InstagramAdapter(),
  linkedin: new LinkedInAdapter(),
  tiktok: new TikTokAdapter(),
  x: new XAdapter(),
  youtube: new YouTubeAdapter(),
};

export function getAdapter(platform: Platform): PlatformAdapter {
  return registry[platform];
}

export function getAllAdapters(): PlatformAdapter[] {
  return Object.values(registry);
}

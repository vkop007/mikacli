import { createPublicSocialCapabilities } from "../shared/public-capabilities.js";
import { pinterestAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const pinterestPlatformDefinition: PlatformDefinition = {
  id: "pinterest",
  category: "social",
  displayName: "Pinterest",
  description: "Search public Pinterest pins and inspect public profiles, boards, and pins through Pinterest's readable web surface",
  authStrategies: ["none"],
  adapter: pinterestAdapter,
  capabilities: createPublicSocialCapabilities(pinterestAdapter, {
    searchDescription: "Search public Pinterest pins by keyword",
    profileDescription: "Load a public Pinterest profile by URL, @username, or username",
    postsDescription: "Load public Pinterest boards for a profile",
    threadDescription: "Load a public Pinterest pin by URL or numeric pin ID",
  }),
  examples: [
    'mikacli pinterest search "interior design"',
    "mikacli pinterest profile pinterest",
    "mikacli pinterest posts pinterest --limit 5",
    "mikacli pinterest thread https://www.pinterest.com/pin/99360735500167749/",
  ],
};

import { createPublicSocialCapabilities } from "../shared/public-capabilities.js";
import { blueskyAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const blueskyPlatformDefinition: PlatformDefinition = {
  id: "bluesky",
  category: "social",
  displayName: "Bluesky",
  description: "Search public Bluesky profiles, inspect profiles, feeds, and threads through the public appview API",
  authStrategies: ["none"],
  adapter: blueskyAdapter,
  capabilities: createPublicSocialCapabilities(blueskyAdapter, {
    searchDescription: "Search public Bluesky profiles through the public appview actor search endpoint",
    profileDescription: "Load a Bluesky profile by URL, @handle, handle, or DID",
    postsDescription: "Load recent public Bluesky posts for a profile",
    threadDescription: "Load a public Bluesky thread by URL or at:// post URI",
  }),
  examples: [
    'autocli bluesky search "karpathy"',
    "autocli bluesky profile karpathy.bsky.social",
    "autocli bluesky posts karpathy.bsky.social --limit 5",
    "autocli bluesky thread https://bsky.app/profile/karpathy.bsky.social/post/3jwoneqcave2h",
  ],
};

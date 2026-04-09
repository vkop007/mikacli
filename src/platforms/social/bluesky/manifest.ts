import { blueskyAdapter } from "./adapter.js";
import { blueskyCapabilities } from "./capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const blueskyPlatformDefinition: PlatformDefinition = {
  id: "bluesky",
  category: "social",
  displayName: "Bluesky",
  description: "Search public Bluesky profiles through the public appview API, then use app-password login for account reads and text interactions",
  authStrategies: ["none", "session"],
  adapter: blueskyAdapter,
  capabilities: blueskyCapabilities,
  examples: [
    "autocli social bluesky login --handle alice.bsky.social --app-password app-password-example",
    "autocli social bluesky me",
    'autocli social bluesky search "karpathy"',
    "autocli social bluesky profile karpathy.bsky.social",
    "autocli social bluesky posts karpathy.bsky.social --limit 5",
    'autocli social bluesky post "Posting from AutoCLI"',
    "autocli social bluesky thread https://bsky.app/profile/karpathy.bsky.social/post/3jwoneqcave2h",
  ],
};

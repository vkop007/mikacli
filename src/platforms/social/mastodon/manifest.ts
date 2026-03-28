import { createPublicSocialCapabilities } from "../shared/public-capabilities.js";
import { mastodonAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const mastodonPlatformDefinition: PlatformDefinition = {
  id: "mastodon",
  category: "social",
  displayName: "Mastodon",
  description: "Search public Mastodon profiles and posts through federated instance APIs",
  authStrategies: ["none"],
  adapter: mastodonAdapter,
  capabilities: createPublicSocialCapabilities(mastodonAdapter, {
    searchDescription: "Search public Mastodon profiles and posts across a Mastodon instance",
    profileDescription: "Load a Mastodon profile by URL, @handle, handle, or username@instance",
    postsDescription: "Load recent public Mastodon posts for a profile",
    threadDescription: "Load a public Mastodon thread by URL or status ID",
  }),
  examples: [
    'autocli social mastodon search "open source"',
    "autocli social mastodon profile mastodon.social/@Gargron",
    "autocli social mastodon posts mastodon.social/@Gargron --limit 5",
    "autocli social mastodon thread 116306409081398966",
  ],
};

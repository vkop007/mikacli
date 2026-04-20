import { createPublicSocialCapabilities } from "../shared/public-capabilities.js";
import { threadsAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const threadsPlatformDefinition: PlatformDefinition = {
  id: "threads",
  category: "social",
  displayName: "Threads",
  description: "Search public Threads results and inspect profiles, feeds, and individual posts through the live web surface",
  authStrategies: ["none"],
  adapter: threadsAdapter,
  capabilities: createPublicSocialCapabilities(threadsAdapter, {
    searchDescription: "Search public Threads posts through the live search page",
    profileDescription: "Load a public Threads profile by URL, @username, or username",
    postsDescription: "Load recent public Threads posts for a profile",
    threadDescription: "Load a public Threads post and its top replies by URL or @username/postId",
  }),
  examples: [
    'mikacli threads search "openai"',
    "mikacli threads profile @zuck",
    "mikacli threads posts @zuck --limit 5",
    "mikacli threads thread https://www.threads.net/@zuck/post/DVrwsE5EdSz",
  ],
};

import { newsAdapter } from "./adapter.js";
import { newsCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const newsPlatformDefinition: PlatformDefinition = {
  id: "news",
  category: "public",
  displayName: "News",
  description: "Browse no-auth news sources from RSS, Google News, GDELT, Hacker News, and Reddit",
  aliases: ["headlines"],
  authStrategies: ["none"],
  adapter: newsAdapter,
  capabilities: newsCapabilities,
  examples: [
    "autocli news sources",
    "autocli news top",
    'autocli news top "AI"',
    'autocli news search "typescript cli"',
    'autocli news search "open source ai" --source google',
    "autocli news feed https://hnrss.org/frontpage",
  ],
};

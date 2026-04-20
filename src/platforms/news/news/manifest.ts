import { newsAdapter } from "./adapter.js";
import { newsCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const newsPlatformDefinition: PlatformDefinition = {
  id: "news",
  category: "news",
  displayName: "News",
  description: "Browse no-auth news sources from RSS, Google News, GDELT, Hacker News, and Reddit",
  aliases: ["headlines"],
  authStrategies: ["none"],
  adapter: newsAdapter,
  capabilities: newsCapabilities,
  examples: [
    "mikacli news sources",
    "mikacli news top",
    'mikacli news top "AI"',
    'mikacli news search "typescript cli"',
    'mikacli news search "open source ai" --source google',
    "mikacli news feed https://hnrss.org/frontpage",
  ],
};

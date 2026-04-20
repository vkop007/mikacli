import { webSearchAdapter } from "./adapter.js";
import { webSearchCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const webSearchPlatformDefinition: PlatformDefinition = {
  id: "websearch",
  category: "tools",
  displayName: "Web Search",
  description: "Search the web across multiple search engines without any account setup",
  aliases: ["web"],
  authStrategies: ["none"],
  adapter: webSearchAdapter,
  capabilities: webSearchCapabilities,
  examples: [
    "mikacli websearch engines",
    'mikacli websearch search "bun cookies fetch"',
    'mikacli websearch search "bun cookies fetch" --summary',
    'mikacli websearch search "typescript cli" --engine bing',
    'mikacli websearch search "typescript cli" --engine yahoo',
    'mikacli websearch search "typescript cli" --engine yandex',
    'mikacli websearch search "typescript cli" --engine baidu',
    'mikacli websearch search "llm agent frameworks" --engine brave --limit 5',
    'mikacli websearch search "terminal weather" --all --limit 3',
  ],
};

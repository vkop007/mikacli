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
    "autocli websearch engines",
    'autocli websearch search "bun cookies fetch"',
    'autocli websearch search "bun cookies fetch" --summary',
    'autocli websearch search "typescript cli" --engine bing',
    'autocli websearch search "typescript cli" --engine yahoo',
    'autocli websearch search "typescript cli" --engine yandex',
    'autocli websearch search "typescript cli" --engine baidu',
    'autocli websearch search "llm agent frameworks" --engine brave --limit 5',
    'autocli websearch search "terminal weather" --all --limit 3',
  ],
};

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { webSearchAdapter, type WebSearchAdapter } from "../adapter.js";
import { printWebSearchEnginesResult } from "../output.js";

export function createWebSearchEnginesCapability(adapter: WebSearchAdapter) {
  return createAdapterActionCapability({
    id: "engines",
    command: "engines",
    description: "List supported web search engines",
    spinnerText: "Loading supported search engines...",
    successMessage: "Search engines loaded.",
    action: () => adapter.engines(),
    onSuccess: printWebSearchEnginesResult,
  });
}

export const webSearchEnginesCapability = createWebSearchEnginesCapability(webSearchAdapter);


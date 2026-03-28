import { webSearchAdapter, type WebSearchAdapter } from "../adapter.js";
import { createWebSearchEnginesCapability } from "./engines.js";
import { createWebSearchSearchCapability } from "./search.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createWebSearchCapabilities(adapter: WebSearchAdapter): readonly PlatformCapability[] {
  return [createWebSearchEnginesCapability(adapter), createWebSearchSearchCapability(adapter)];
}

export const webSearchCapabilities: readonly PlatformCapability[] = createWebSearchCapabilities(webSearchAdapter);


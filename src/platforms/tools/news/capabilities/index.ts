import { newsSourcesCapability } from "./sources.js";
import { newsTopCapability } from "./top.js";
import { newsSearchCapability } from "./search.js";
import { newsFeedCapability } from "./feed.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const newsCapabilities: readonly PlatformCapability[] = [
  newsSourcesCapability,
  newsTopCapability,
  newsSearchCapability,
  newsFeedCapability,
];

import { stocksAdapter, type StocksAdapter } from "../adapter.js";
import { createStocksQuoteCapability } from "./stocks.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createStocksCapabilities(adapter: StocksAdapter): readonly PlatformCapability[] {
  return [createStocksQuoteCapability(adapter)];
}

export const stocksCapabilities: readonly PlatformCapability[] = createStocksCapabilities(stocksAdapter);

import { currencyAdapter, type CurrencyAdapter } from "../adapter.js";
import { createCurrencyCapability } from "./currency.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createCurrencyCapabilities(adapter: CurrencyAdapter): readonly PlatformCapability[] {
  return [createCurrencyCapability(adapter)];
}

export const currencyCapabilities: readonly PlatformCapability[] = createCurrencyCapabilities(currencyAdapter);

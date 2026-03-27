import { cryptoAdapter, type CryptoAdapter } from "../adapter.js";
import { createCryptoPriceCapability } from "./crypto.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createCryptoCapabilities(adapter: CryptoAdapter): readonly PlatformCapability[] {
  return [createCryptoPriceCapability(adapter)];
}

export const cryptoCapabilities: readonly PlatformCapability[] = createCryptoCapabilities(cryptoAdapter);

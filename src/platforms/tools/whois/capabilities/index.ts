import { whoisAdapter, type WhoisAdapter } from "../adapter.js";
import { createWhoisLookupCapability } from "./whois.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createWhoisCapabilities(adapter: WhoisAdapter): readonly PlatformCapability[] {
  return [createWhoisLookupCapability(adapter)];
}

export const whoisCapabilities: readonly PlatformCapability[] = createWhoisCapabilities(whoisAdapter);

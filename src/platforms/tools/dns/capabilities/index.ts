import { dnsAdapter, type DnsAdapter } from "../adapter.js";
import { createDnsLookupCapability } from "./dns.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createDnsCapabilities(adapter: DnsAdapter): readonly PlatformCapability[] {
  return [createDnsLookupCapability(adapter)];
}

export const dnsCapabilities: readonly PlatformCapability[] = createDnsCapabilities(dnsAdapter);

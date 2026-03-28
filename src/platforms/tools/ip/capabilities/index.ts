import { ipAdapter, type IpAdapter } from "../adapter.js";
import { createIpLookupCapability } from "./ip.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createIpCapabilities(adapter: IpAdapter): readonly PlatformCapability[] {
  return [createIpLookupCapability(adapter)];
}

export const ipCapabilities: readonly PlatformCapability[] = createIpCapabilities(ipAdapter);

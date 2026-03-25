import { timeAdapter, type TimeAdapter } from "../adapter.js";
import { createTimeLookupCapability } from "./time.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createTimeCapabilities(adapter: TimeAdapter): readonly PlatformCapability[] {
  return [createTimeLookupCapability(adapter)];
}

export const timeCapabilities: readonly PlatformCapability[] = createTimeCapabilities(timeAdapter);

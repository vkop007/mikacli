import { jwtAdapter, type JwtAdapter } from "../adapter.js";
import { createJwtDecodeCapability } from "./jwt.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createJwtCapabilities(adapter: JwtAdapter): readonly PlatformCapability[] {
  return [createJwtDecodeCapability(adapter)];
}

export const jwtCapabilities: readonly PlatformCapability[] = createJwtCapabilities(jwtAdapter);

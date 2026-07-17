import { jwtAdapter, type JwtAdapter } from "../adapter.js";
import { createJwtDecodeCapability } from "./jwt.js";
import { createJwtVerifyCapability } from "./verify.js";
import { createJwtSignCapability } from "./sign.js";
import { createJwtAuditCapability } from "./audit.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createJwtCapabilities(adapter: JwtAdapter): readonly PlatformCapability[] {
  return [
    createJwtDecodeCapability(adapter),
    createJwtVerifyCapability(adapter),
    createJwtSignCapability(adapter),
    createJwtAuditCapability(adapter),
  ];
}

export const jwtCapabilities: readonly PlatformCapability[] = createJwtCapabilities(jwtAdapter);

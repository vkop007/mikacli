import { hashAdapter, type HashAdapter } from "../adapter.js";
import { createHashAlgorithmsCapability } from "./algorithms.js";
import { createHashDigestCapability } from "./digest.js";
import { createHashEncodeCapability } from "./encode.js";
import { createHashHmacCapability } from "./hmac.js";
import { createHashRandomCapability } from "./random.js";
import { createHashUuidCapability } from "./uuid.js";
import { createHashVerifyCapability } from "./verify.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createHashCapabilities(adapter: HashAdapter): readonly PlatformCapability[] {
  return [
    createHashDigestCapability(adapter),
    createHashHmacCapability(adapter),
    createHashVerifyCapability(adapter),
    createHashEncodeCapability(adapter),
    createHashUuidCapability(adapter),
    createHashRandomCapability(adapter),
    createHashAlgorithmsCapability(adapter),
  ];
}

export const hashCapabilities: readonly PlatformCapability[] = createHashCapabilities(hashAdapter);

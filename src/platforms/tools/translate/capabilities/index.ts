import { translateAdapter, type TranslateAdapter } from "../adapter.js";
import { createTranslateCapability } from "./translate.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createTranslateCapabilities(adapter: TranslateAdapter): readonly PlatformCapability[] {
  return [createTranslateCapability(adapter)];
}

export const translateCapabilities: readonly PlatformCapability[] = createTranslateCapabilities(translateAdapter);

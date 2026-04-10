import { confluenceAdapter, type ConfluenceAdapter } from "../adapter.js";
import { createConfluenceLoginCapability } from "./login.js";
import { createConfluenceMeCapability } from "./me.js";
import { createConfluenceChildrenCapability, createConfluenceCommentCapability, createConfluenceCreatePageCapability, createConfluencePageCapability, createConfluenceSearchCapability, createConfluenceUpdatePageCapability } from "./pages.js";
import { createConfluenceSpacesCapability } from "./spaces.js";

import { createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createConfluenceCapabilities(adapter: ConfluenceAdapter): readonly PlatformCapability[] {
  return [
    createConfluenceLoginCapability(adapter),
    createAdapterStatusCapability({ adapter, subject: "session" }),
    createConfluenceMeCapability(adapter),
    createConfluenceSpacesCapability(adapter),
    createConfluenceSearchCapability(adapter),
    createConfluencePageCapability(adapter),
    createConfluenceChildrenCapability(adapter),
    createConfluenceCreatePageCapability(adapter),
    createConfluenceUpdatePageCapability(adapter),
    createConfluenceCommentCapability(adapter),
  ];
}

export const confluenceCapabilities: readonly PlatformCapability[] = createConfluenceCapabilities(confluenceAdapter);

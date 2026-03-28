import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { createNotionCommentCapability } from "./comments.js";
import { createNotionDataSourceCapability, createNotionQueryCapability } from "./data-sources.js";
import { createNotionLoginCapability } from "./login.js";
import { createNotionMeCapability } from "./me.js";
import { createNotionAppendCapability, createNotionCreatePageCapability, createNotionPageCapability, createNotionUpdatePageCapability } from "./pages.js";
import { createNotionDataSourcesCapability, createNotionPagesCapability, createNotionSearchCapability } from "./search.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createNotionCapabilities(adapter: NotionAdapter): readonly PlatformCapability[] {
  return [
    createNotionLoginCapability(adapter),
    createNotionMeCapability(adapter),
    createNotionSearchCapability(adapter),
    createNotionPagesCapability(adapter),
    createNotionPageCapability(adapter),
    createNotionCreatePageCapability(adapter),
    createNotionUpdatePageCapability(adapter),
    createNotionAppendCapability(adapter),
    createNotionDataSourcesCapability(adapter),
    createNotionDataSourceCapability(adapter),
    createNotionQueryCapability(adapter),
    createNotionCommentCapability(adapter),
  ];
}

export const notionCapabilities: readonly PlatformCapability[] = createNotionCapabilities(notionAdapter);


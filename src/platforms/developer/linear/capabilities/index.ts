import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { linearCommentCapability, createLinearCommentCapability } from "./comments.js";
import { linearCreateIssueCapability, createLinearCreateIssueCapability, linearIssueCapability, createLinearIssueCapability, linearIssuesCapability, createLinearIssuesCapability, linearUpdateIssueCapability, createLinearUpdateIssueCapability } from "./issues.js";
import { linearLoginCapability, createLinearLoginCapability } from "./login.js";
import { linearMeCapability, createLinearMeCapability } from "./me.js";
import { linearProjectsCapability, createLinearProjectsCapability } from "./projects.js";
import { linearTeamsCapability, createLinearTeamsCapability } from "./teams.js";

import { createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createLinearCapabilities(adapter: LinearAdapter): readonly PlatformCapability[] {
  return [
    createLinearLoginCapability(adapter),
    createAdapterStatusCapability({ adapter, subject: "session" }),
    createLinearMeCapability(adapter),
    createLinearTeamsCapability(adapter),
    createLinearProjectsCapability(adapter),
    createLinearIssuesCapability(adapter),
    createLinearIssueCapability(adapter),
    createLinearCreateIssueCapability(adapter),
    createLinearUpdateIssueCapability(adapter),
    createLinearCommentCapability(adapter),
  ];
}

export const linearCapabilities: readonly PlatformCapability[] = createLinearCapabilities(linearAdapter);

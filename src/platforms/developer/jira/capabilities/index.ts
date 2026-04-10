import { jiraAdapter, type JiraAdapter } from "../adapter.js";
import { createJiraIssueCapability, createJiraIssuesCapability, createJiraCreateIssueCapability } from "./issues.js";
import { createJiraLoginCapability } from "./login.js";
import { createJiraMeCapability } from "./me.js";
import { createJiraProjectCapability, createJiraProjectsCapability } from "./projects.js";

import { createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createJiraCapabilities(adapter: JiraAdapter): readonly PlatformCapability[] {
  return [
    createJiraLoginCapability(adapter),
    createAdapterStatusCapability({ adapter, subject: "session" }),
    createJiraMeCapability(adapter),
    createJiraProjectsCapability(adapter),
    createJiraProjectCapability(adapter),
    createJiraIssuesCapability(adapter),
    createJiraIssueCapability(adapter),
    createJiraCreateIssueCapability(adapter),
  ];
}

export const jiraCapabilities: readonly PlatformCapability[] = createJiraCapabilities(jiraAdapter);

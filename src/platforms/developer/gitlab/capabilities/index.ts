import { gitlabAdapter, type GitLabAdapter } from "../adapter.js";
import { createGitLabCreateIssueCapability, createGitLabIssueCapability, createGitLabIssuesCapability } from "./issues.js";
import { createGitLabLoginCapability } from "./login.js";
import { createGitLabMeCapability } from "./me.js";
import { createGitLabMergeRequestCapability, createGitLabMergeRequestsCapability } from "./merge-requests.js";
import { createGitLabProjectCapability, createGitLabProjectsCapability, createGitLabSearchProjectsCapability } from "./projects.js";

import { createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createGitLabCapabilities(adapter: GitLabAdapter): readonly PlatformCapability[] {
  return [
    createGitLabLoginCapability(adapter),
    createAdapterStatusCapability({ adapter, subject: "session" }),
    createGitLabMeCapability(adapter),
    createGitLabProjectsCapability(adapter),
    createGitLabProjectCapability(adapter),
    createGitLabSearchProjectsCapability(adapter),
    createGitLabIssuesCapability(adapter),
    createGitLabIssueCapability(adapter),
    createGitLabCreateIssueCapability(adapter),
    createGitLabMergeRequestsCapability(adapter),
    createGitLabMergeRequestCapability(adapter),
  ];
}

export const gitlabCapabilities: readonly PlatformCapability[] = createGitLabCapabilities(gitlabAdapter);

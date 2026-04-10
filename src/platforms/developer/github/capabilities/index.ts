import { githubAdapter, type GitHubAdapter } from "../adapter.js";
import { createGitHubBranchCapability, createGitHubBranchesCapability } from "./branches.js";
import { createGitHubCommentCapability, createGitHubForkCapability, createGitHubReadmeCapability, createGitHubReleasesCapability, createGitHubStarredCapability } from "./extra.js";
import { createGitHubIssueCapability, createGitHubIssuesCapability, createGitHubCreateIssueCapability, createGitHubCreateRepoCapability } from "./issues.js";
import { createGitHubLoginCapability } from "./login.js";
import { createGitHubMeCapability } from "./me.js";
import { createGitHubPullCapability, createGitHubPullsCapability } from "./pulls.js";
import { createGitHubRepoCapability, createGitHubReposCapability, createGitHubSearchReposCapability } from "./repos.js";
import { createGitHubStarCapability, createGitHubUnstarCapability } from "./stars.js";
import { createGitHubUserCapability } from "./users.js";

import { createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createGitHubCapabilities(adapter: GitHubAdapter): readonly PlatformCapability[] {
  return [
    createGitHubLoginCapability(adapter),
    createAdapterStatusCapability({
      adapter,
      subject: adapter.authMode === "cookies" ? "session" : "connection",
    }),
    createGitHubMeCapability(adapter),
    createGitHubUserCapability(adapter),
    createGitHubReposCapability(adapter),
    createGitHubRepoCapability(adapter),
    createGitHubSearchReposCapability(adapter),
    createGitHubStarredCapability(adapter),
    createGitHubBranchesCapability(adapter),
    createGitHubBranchCapability(adapter),
    createGitHubIssuesCapability(adapter),
    createGitHubIssueCapability(adapter),
    createGitHubPullsCapability(adapter),
    createGitHubPullCapability(adapter),
    createGitHubReleasesCapability(adapter),
    createGitHubReadmeCapability(adapter),
    createGitHubCreateIssueCapability(adapter),
    createGitHubCommentCapability(adapter),
    createGitHubCreateRepoCapability(adapter),
    createGitHubForkCapability(adapter),
    createGitHubStarCapability(adapter),
    createGitHubUnstarCapability(adapter),
  ];
}

export const githubCapabilities: readonly PlatformCapability[] = createGitHubCapabilities(githubAdapter);

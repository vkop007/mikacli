import { githubBranchCapability, githubBranchesCapability } from "./branches.js";
import { githubCommentCapability, githubForkCapability, githubReadmeCapability, githubReleasesCapability, githubStarredCapability } from "./extra.js";
import { githubIssueCapability, githubIssuesCapability, githubCreateIssueCapability, githubCreateRepoCapability } from "./issues.js";
import { githubLoginCapability } from "./login.js";
import { githubMeCapability } from "./me.js";
import { githubPullCapability, githubPullsCapability } from "./pulls.js";
import { githubRepoCapability, githubReposCapability, githubSearchReposCapability } from "./repos.js";
import { githubStarCapability, githubUnstarCapability } from "./stars.js";
import { githubUserCapability } from "./users.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const githubCapabilities: readonly PlatformCapability[] = [
  githubLoginCapability,
  githubMeCapability,
  githubUserCapability,
  githubReposCapability,
  githubRepoCapability,
  githubSearchReposCapability,
  githubStarredCapability,
  githubBranchesCapability,
  githubBranchCapability,
  githubIssuesCapability,
  githubIssueCapability,
  githubPullsCapability,
  githubPullCapability,
  githubReleasesCapability,
  githubReadmeCapability,
  githubCreateIssueCapability,
  githubCommentCapability,
  githubCreateRepoCapability,
  githubForkCapability,
  githubStarCapability,
  githubUnstarCapability,
];

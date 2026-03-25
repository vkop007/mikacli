import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printGitHubIdentityResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const user = result.data?.user as Record<string, unknown> | undefined;
  if (!user) {
    return;
  }

  const meta = [
    typeof user.displayName === "string" ? user.displayName : undefined,
    typeof user.username === "string" ? `@${user.username}` : undefined,
    typeof user.id === "string" ? user.id : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof user.publicRepos === "number") {
    console.log(`public repos: ${user.publicRepos}`);
  }

  if (typeof user.url === "string") {
    console.log(user.url);
  }
}

export function printGitHubReposResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const repos = Array.isArray(result.data?.repos) ? result.data.repos : [];
  for (const [index, rawRepo] of repos.entries()) {
    if (!rawRepo || typeof rawRepo !== "object") {
      continue;
    }

    const repo = rawRepo as {
      fullName?: string;
      description?: string | null;
      private?: boolean;
      language?: string | null;
      stars?: number;
      forks?: number;
      url?: string;
      updatedAt?: string;
    };

    const meta = [
      repo.private ? "private" : "public",
      typeof repo.language === "string" && repo.language.length > 0 ? repo.language : undefined,
      typeof repo.stars === "number" ? `${repo.stars} stars` : undefined,
      typeof repo.forks === "number" ? `${repo.forks} forks` : undefined,
      typeof repo.updatedAt === "string" ? `updated ${repo.updatedAt}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${repo.fullName ?? "unknown repo"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof repo.description === "string" && repo.description.trim().length > 0) {
      console.log(`   ${repo.description.trim()}`);
    }
    if (typeof repo.url === "string") {
      console.log(`   ${repo.url}`);
    }
  }
}

export function printGitHubRepoResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const repo = result.data?.repo as Record<string, unknown> | undefined;
  if (!repo) {
    return;
  }

  const meta = [
    repo.private ? "private" : "public",
    typeof repo.language === "string" ? repo.language : undefined,
    typeof repo.stars === "number" ? `${repo.stars} stars` : undefined,
    typeof repo.forks === "number" ? `${repo.forks} forks` : undefined,
    typeof repo.defaultBranch === "string" ? `default ${repo.defaultBranch}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof repo.fullName === "string") {
    console.log(repo.fullName);
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof repo.description === "string" && repo.description.trim().length > 0) {
    console.log(repo.description.trim());
  }
  if (typeof repo.url === "string") {
    console.log(repo.url);
  }
}

export function printGitHubIssuesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const issues = Array.isArray(result.data?.issues) ? result.data.issues : [];
  for (const [index, rawIssue] of issues.entries()) {
    if (!rawIssue || typeof rawIssue !== "object") {
      continue;
    }

    const issue = rawIssue as {
      number?: number;
      title?: string;
      state?: string;
      author?: string;
      comments?: number;
      url?: string;
      createdAt?: string;
    };

    const meta = [
      typeof issue.state === "string" ? issue.state : undefined,
      typeof issue.author === "string" ? `@${issue.author}` : undefined,
      typeof issue.comments === "number" ? `${issue.comments} comments` : undefined,
      typeof issue.createdAt === "string" ? issue.createdAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. #${issue.number ?? "?"} ${issue.title ?? "Untitled issue"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof issue.url === "string") {
      console.log(`   ${issue.url}`);
    }
  }
}

export function printGitHubIssueResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const issue = result.data?.issue as Record<string, unknown> | undefined;
  if (!issue) {
    return;
  }

  const meta = [
    typeof issue.state === "string" ? issue.state : undefined,
    typeof issue.author === "string" ? `@${issue.author}` : undefined,
    typeof issue.comments === "number" ? `${issue.comments} comments` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof issue.number === "number" || typeof issue.title === "string") {
    console.log(`#${typeof issue.number === "number" ? issue.number : "?"} ${typeof issue.title === "string" ? issue.title : ""}`.trim());
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof issue.body === "string" && issue.body.trim().length > 0) {
    console.log(issue.body.trim());
  }
  if (typeof issue.url === "string") {
    console.log(issue.url);
  }
}

export function printGitHubBranchesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const branches = Array.isArray(result.data?.branches) ? result.data.branches : [];
  for (const [index, rawBranch] of branches.entries()) {
    if (!rawBranch || typeof rawBranch !== "object") {
      continue;
    }

    const branch = rawBranch as {
      name?: string;
      protected?: boolean;
      commitSha?: string;
    };

    const meta = [
      branch.protected ? "protected" : undefined,
      typeof branch.commitSha === "string" ? branch.commitSha.slice(0, 7) : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${branch.name ?? "unknown branch"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}

export function printGitHubBranchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const branch = result.data?.branch as Record<string, unknown> | undefined;
  if (!branch) {
    return;
  }

  const meta = [
    branch.protected ? "protected" : undefined,
    typeof branch.commitSha === "string" ? branch.commitSha : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof branch.name === "string") {
    console.log(branch.name);
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
}

export function printGitHubPullsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const pulls = Array.isArray(result.data?.pulls) ? result.data.pulls : [];
  for (const [index, rawPull] of pulls.entries()) {
    if (!rawPull || typeof rawPull !== "object") {
      continue;
    }

    const pull = rawPull as {
      number?: number;
      title?: string;
      state?: string;
      author?: string;
      head?: string;
      base?: string;
      url?: string;
      draft?: boolean;
    };

    const meta = [
      typeof pull.state === "string" ? pull.state : undefined,
      pull.draft ? "draft" : undefined,
      typeof pull.author === "string" ? `@${pull.author}` : undefined,
      typeof pull.head === "string" && typeof pull.base === "string" ? `${pull.head} -> ${pull.base}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. #${pull.number ?? "?"} ${pull.title ?? "Untitled PR"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof pull.url === "string") {
      console.log(`   ${pull.url}`);
    }
  }
}

export function printGitHubPullResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const pull = result.data?.pull as Record<string, unknown> | undefined;
  if (!pull) {
    return;
  }

  const meta = [
    typeof pull.state === "string" ? pull.state : undefined,
    pull.draft ? "draft" : undefined,
    typeof pull.author === "string" ? `@${pull.author}` : undefined,
    typeof pull.head === "string" && typeof pull.base === "string" ? `${pull.head} -> ${pull.base}` : undefined,
    typeof pull.changedFiles === "number" ? `${pull.changedFiles} files` : undefined,
    typeof pull.additions === "number" ? `+${pull.additions}` : undefined,
    typeof pull.deletions === "number" ? `-${pull.deletions}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof pull.number === "number" || typeof pull.title === "string") {
    console.log(`#${typeof pull.number === "number" ? pull.number : "?"} ${typeof pull.title === "string" ? pull.title : ""}`.trim());
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof pull.body === "string" && pull.body.trim().length > 0) {
    console.log(pull.body.trim());
  }
  if (typeof pull.url === "string") {
    console.log(pull.url);
  }
}

export function printGitHubReleasesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const releases = Array.isArray(result.data?.releases) ? result.data.releases : [];
  for (const [index, rawRelease] of releases.entries()) {
    if (!rawRelease || typeof rawRelease !== "object") {
      continue;
    }

    const release = rawRelease as {
      tag?: string;
      name?: string;
      draft?: boolean;
      prerelease?: boolean;
      publishedAt?: string | null;
      url?: string;
    };

    const meta = [
      release.draft ? "draft" : undefined,
      release.prerelease ? "prerelease" : undefined,
      typeof release.publishedAt === "string" ? release.publishedAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${release.name ?? release.tag ?? "Unnamed release"}`);
    if (typeof release.tag === "string") {
      console.log(`   tag: ${release.tag}`);
    }
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof release.url === "string") {
      console.log(`   ${release.url}`);
    }
  }
}

export function printGitHubReadmeResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const readme = result.data?.readme as Record<string, unknown> | undefined;
  if (!readme) {
    return;
  }

  const meta = [
    typeof readme.name === "string" ? readme.name : undefined,
    typeof readme.path === "string" ? readme.path : undefined,
    typeof readme.size === "number" ? `${readme.size} bytes` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof readme.url === "string") {
    console.log(readme.url);
  }
  if (typeof readme.content === "string" && readme.content.trim().length > 0) {
    const preview = readme.content.length > 4000 ? `${readme.content.slice(0, 4000)}\n...` : readme.content;
    console.log(preview.trim());
  }
}

export function printGitHubCommentResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const comment = result.data?.comment as Record<string, unknown> | undefined;
  if (!comment) {
    return;
  }

  const meta = [
    typeof comment.author === "string" ? `@${comment.author}` : undefined,
    typeof comment.createdAt === "string" ? comment.createdAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof comment.body === "string" && comment.body.trim().length > 0) {
    console.log(comment.body.trim());
  }
  if (typeof comment.url === "string") {
    console.log(comment.url);
  }
}

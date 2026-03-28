import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printGitLabIdentityResult(result: AdapterActionResult, json: boolean): void {
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

  if (typeof user.url === "string") {
    console.log(user.url);
  }
}

export function printGitLabProjectsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const projects = Array.isArray(result.data?.projects) ? result.data.projects : [];
  for (const [index, rawProject] of projects.entries()) {
    if (!rawProject || typeof rawProject !== "object") {
      continue;
    }

    const project = rawProject as {
      id?: number;
      pathWithNamespace?: string;
      description?: string | null;
      visibility?: string;
      stars?: number;
      forks?: number;
      openIssues?: number;
      defaultBranch?: string | null;
      updatedAt?: string;
      url?: string;
    };

    const meta = [
      typeof project.visibility === "string" ? project.visibility : undefined,
      typeof project.defaultBranch === "string" ? `default ${project.defaultBranch}` : undefined,
      typeof project.stars === "number" ? `${project.stars} stars` : undefined,
      typeof project.forks === "number" ? `${project.forks} forks` : undefined,
      typeof project.openIssues === "number" ? `${project.openIssues} open issues` : undefined,
      typeof project.updatedAt === "string" ? `updated ${project.updatedAt}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${project.pathWithNamespace ?? project.id ?? "unknown project"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof project.description === "string" && project.description.trim().length > 0) {
      console.log(`   ${project.description.trim()}`);
    }
    if (typeof project.url === "string") {
      console.log(`   ${project.url}`);
    }
  }
}

export function printGitLabProjectResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const project = result.data?.project as Record<string, unknown> | undefined;
  if (!project) {
    return;
  }

  const meta = [
    typeof project.visibility === "string" ? project.visibility : undefined,
    typeof project.defaultBranch === "string" ? `default ${project.defaultBranch}` : undefined,
    typeof project.stars === "number" ? `${project.stars} stars` : undefined,
    typeof project.forks === "number" ? `${project.forks} forks` : undefined,
    typeof project.openIssues === "number" ? `${project.openIssues} open issues` : undefined,
    typeof project.updatedAt === "string" ? `updated ${project.updatedAt}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof project.pathWithNamespace === "string") {
    console.log(project.pathWithNamespace);
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof project.description === "string" && project.description.trim().length > 0) {
    console.log(project.description.trim());
  }
  if (typeof project.url === "string") {
    console.log(project.url);
  }
}

export function printGitLabIssuesResult(result: AdapterActionResult, json: boolean): void {
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
      iid?: number;
      title?: string;
      state?: string;
      author?: string;
      commentsCount?: number;
      url?: string;
      createdAt?: string;
    };

    const meta = [
      typeof issue.state === "string" ? issue.state : undefined,
      typeof issue.author === "string" ? `@${issue.author}` : undefined,
      typeof issue.commentsCount === "number" ? `${issue.commentsCount} comments` : undefined,
      typeof issue.createdAt === "string" ? issue.createdAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. !${issue.iid ?? "?"} ${issue.title ?? "Untitled issue"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof issue.url === "string") {
      console.log(`   ${issue.url}`);
    }
  }
}

export function printGitLabIssueResult(result: AdapterActionResult, json: boolean): void {
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
    typeof issue.commentsCount === "number" ? `${issue.commentsCount} comments` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof issue.iid === "number" || typeof issue.title === "string") {
    console.log(`!${typeof issue.iid === "number" ? issue.iid : "?"} ${typeof issue.title === "string" ? issue.title : ""}`.trim());
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof issue.description === "string" && issue.description.trim().length > 0) {
    console.log(issue.description.trim());
  }
  if (typeof issue.url === "string") {
    console.log(issue.url);
  }
}

export function printGitLabMergeRequestsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const mergeRequests = Array.isArray(result.data?.mergeRequests) ? result.data.mergeRequests : [];
  for (const [index, rawMergeRequest] of mergeRequests.entries()) {
    if (!rawMergeRequest || typeof rawMergeRequest !== "object") {
      continue;
    }

    const mergeRequest = rawMergeRequest as {
      iid?: number;
      title?: string;
      state?: string;
      author?: string;
      commentsCount?: number;
      sourceBranch?: string;
      targetBranch?: string;
      url?: string;
      createdAt?: string;
      draft?: boolean;
    };

    const meta = [
      typeof mergeRequest.state === "string" ? mergeRequest.state : undefined,
      mergeRequest.draft ? "draft" : undefined,
      typeof mergeRequest.author === "string" ? `@${mergeRequest.author}` : undefined,
      typeof mergeRequest.sourceBranch === "string" ? `${mergeRequest.sourceBranch} -> ${mergeRequest.targetBranch ?? "?"}` : undefined,
      typeof mergeRequest.commentsCount === "number" ? `${mergeRequest.commentsCount} comments` : undefined,
      typeof mergeRequest.createdAt === "string" ? mergeRequest.createdAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. !${mergeRequest.iid ?? "?"} ${mergeRequest.title ?? "Untitled merge request"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof mergeRequest.url === "string") {
      console.log(`   ${mergeRequest.url}`);
    }
  }
}

export function printGitLabMergeRequestResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const mergeRequest = result.data?.mergeRequest as Record<string, unknown> | undefined;
  if (!mergeRequest) {
    return;
  }

  const meta = [
    typeof mergeRequest.state === "string" ? mergeRequest.state : undefined,
    mergeRequest.draft ? "draft" : undefined,
    typeof mergeRequest.author === "string" ? `@${mergeRequest.author}` : undefined,
    typeof mergeRequest.sourceBranch === "string" ? `${mergeRequest.sourceBranch} -> ${mergeRequest.targetBranch ?? "?"}` : undefined,
    typeof mergeRequest.commentsCount === "number" ? `${mergeRequest.commentsCount} comments` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof mergeRequest.iid === "number" || typeof mergeRequest.title === "string") {
    console.log(`!${typeof mergeRequest.iid === "number" ? mergeRequest.iid : "?"} ${typeof mergeRequest.title === "string" ? mergeRequest.title : ""}`.trim());
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof mergeRequest.description === "string" && mergeRequest.description.trim().length > 0) {
    console.log(mergeRequest.description.trim());
  }
  if (typeof mergeRequest.url === "string") {
    console.log(mergeRequest.url);
  }
}


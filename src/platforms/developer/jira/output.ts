import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printJiraIdentityResult(result: AdapterActionResult, json: boolean): void {
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
    typeof user.email === "string" ? user.email : undefined,
    typeof user.id === "string" ? user.id : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof result.data?.siteUrl === "string") {
    console.log(result.data.siteUrl);
  }
}

export function printJiraProjectsResult(result: AdapterActionResult, json: boolean): void {
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
      key?: string;
      name?: string;
      projectType?: string;
      lead?: string;
      url?: string;
      description?: string;
    };

    console.log(`${index + 1}. ${project.key ?? "?"} ${project.name ?? ""}`.trim());
    const meta = [
      typeof project.projectType === "string" ? project.projectType : undefined,
      typeof project.lead === "string" ? `lead ${project.lead}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
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

export function printJiraProjectResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const project = result.data?.project as Record<string, unknown> | undefined;
  if (!project) {
    return;
  }

  if (typeof project.key === "string" || typeof project.name === "string") {
    console.log(`${typeof project.key === "string" ? project.key : "?"} ${typeof project.name === "string" ? project.name : ""}`.trim());
  }

  const meta = [
    typeof project.projectType === "string" ? project.projectType : undefined,
    typeof project.lead === "string" ? `lead ${project.lead}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
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

export function printJiraIssuesResult(result: AdapterActionResult, json: boolean): void {
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
      key?: string;
      title?: string;
      issueType?: string;
      state?: string;
      assignee?: string;
      updatedAt?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${issue.key ?? "?"} ${issue.title ?? "Untitled issue"}`);
    const meta = [
      typeof issue.issueType === "string" ? issue.issueType : undefined,
      typeof issue.state === "string" ? issue.state : undefined,
      typeof issue.assignee === "string" ? issue.assignee : undefined,
      typeof issue.updatedAt === "string" ? issue.updatedAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof issue.url === "string") {
      console.log(`   ${issue.url}`);
    }
  }
}

export function printJiraIssueResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const issue = result.data?.issue as Record<string, unknown> | undefined;
  if (!issue) {
    return;
  }

  if (typeof issue.key === "string" || typeof issue.title === "string") {
    console.log(`${typeof issue.key === "string" ? issue.key : "?"} ${typeof issue.title === "string" ? issue.title : ""}`.trim());
  }

  const meta = [
    typeof issue.issueType === "string" ? issue.issueType : undefined,
    typeof issue.state === "string" ? issue.state : undefined,
    typeof issue.priority === "string" ? issue.priority : undefined,
    typeof issue.assignee === "string" ? issue.assignee : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
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

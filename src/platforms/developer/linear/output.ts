import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printLinearIdentityResult(result: AdapterActionResult, json: boolean): void {
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
}

export function printLinearTeamsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const teams = Array.isArray(result.data?.teams) ? result.data.teams : [];
  for (const [index, rawTeam] of teams.entries()) {
    if (!rawTeam || typeof rawTeam !== "object") {
      continue;
    }

    const team = rawTeam as { id?: string; name?: string; key?: string; description?: string };
    console.log(`${index + 1}. ${team.key ?? team.id ?? "unknown team"} ${team.name ?? ""}`.trim());
    const meta = [typeof team.id === "string" ? team.id : undefined].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof team.description === "string" && team.description.trim().length > 0) {
      console.log(`   ${team.description.trim()}`);
    }
  }
}

export function printLinearProjectsResult(result: AdapterActionResult, json: boolean): void {
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

    const project = rawProject as { id?: string; name?: string; description?: string };
    console.log(`${index + 1}. ${project.name ?? "Untitled project"}`);
    if (typeof project.id === "string") {
      console.log(`   ${project.id}`);
    }
    if (typeof project.description === "string" && project.description.trim().length > 0) {
      console.log(`   ${project.description.trim()}`);
    }
  }
}

export function printLinearIssuesResult(result: AdapterActionResult, json: boolean): void {
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
      id?: string;
      identifier?: string;
      title?: string;
      description?: string | null;
      state?: { name?: string };
      team?: { key?: string; name?: string };
    };

    const meta = [
      typeof issue.identifier === "string" ? issue.identifier : undefined,
      typeof issue.state?.name === "string" ? issue.state.name : undefined,
      typeof issue.team?.key === "string" ? issue.team.key : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${issue.title ?? issue.id ?? "Untitled issue"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof issue.description === "string" && issue.description.trim().length > 0) {
      console.log(`   ${issue.description.trim()}`);
    }
  }
}

export function printLinearIssueResult(result: AdapterActionResult, json: boolean): void {
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
    typeof issue.identifier === "string" ? issue.identifier : undefined,
    typeof issue.state === "object" && issue.state && typeof (issue.state as { name?: string }).name === "string"
      ? (issue.state as { name?: string }).name
      : undefined,
    typeof issue.team === "object" && issue.team && typeof (issue.team as { key?: string }).key === "string"
      ? (issue.team as { key?: string }).key
      : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof issue.title === "string") {
    console.log(issue.title);
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof issue.description === "string" && issue.description.trim().length > 0) {
    console.log(issue.description.trim());
  }
}

export function printLinearCommentResult(result: AdapterActionResult, json: boolean): void {
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
    typeof comment.id === "string" ? comment.id : undefined,
    typeof comment.createdAt === "string" ? comment.createdAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof comment.body === "string" && comment.body.trim().length > 0) {
    console.log(comment.body.trim());
  }
}


import { MikaCliError } from "../../../errors.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";

import type { CookieJar } from "tough-cookie";

const JIRA_ISSUE_KEY_REGEX = /^[A-Z][A-Z0-9]+-\d+$/iu;
const ATLASSIAN_HOST_IGNORE = new Set(["id.atlassian.com", "admin.atlassian.com", "api.atlassian.com"]);

export function normalizeJiraSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new MikaCliError("JIRA_SITE_REQUIRED", "Provide a Jira site URL like https://your-workspace.atlassian.net.");
  }

  const withProtocol = /^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch (error) {
    throw new MikaCliError("JIRA_SITE_INVALID", `Invalid Jira site URL "${input}".`, {
      cause: error,
      details: { input },
    });
  }

  return url.origin;
}

export async function inferJiraSiteUrlFromJar(jar: CookieJar): Promise<string | undefined> {
  const serialized = serializeCookieJar(jar);
  const domains = Array.isArray(serialized.cookies)
    ? serialized.cookies
        .map((cookie) => (typeof cookie.domain === "string" ? normalizeDomain(cookie.domain) : undefined))
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  const preferred = domains.find((domain) => domain.endsWith(".atlassian.net"));
  if (preferred) {
    return `https://${preferred}`;
  }

  const fallback = domains.find((domain) => domain.includes(".") && !ATLASSIAN_HOST_IGNORE.has(domain) && !domain.endsWith(".trello.com") && domain !== "trello.com");
  return fallback ? `https://${fallback}` : undefined;
}

export function getStoredJiraSiteUrl(metadata?: Record<string, unknown>): string | undefined {
  const candidate = metadata?.siteUrl;
  return typeof candidate === "string" && candidate.trim().length > 0 ? normalizeJiraSiteUrl(candidate) : undefined;
}

export function normalizeJiraProjectTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new MikaCliError("JIRA_PROJECT_TARGET_INVALID", "Jira project target cannot be empty.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const fromBrowse = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+)-\d+/iu)?.[1];
    if (fromBrowse) {
      return fromBrowse.toUpperCase();
    }

    const projectMatch =
      url.pathname.match(/\/projects\/([^/]+)/iu)?.[1] ??
      url.pathname.match(/\/jira\/software\/projects\/([^/]+)/iu)?.[1];
    if (projectMatch) {
      return decodeURIComponent(projectMatch);
    }

    throw new MikaCliError("JIRA_PROJECT_TARGET_INVALID", `Could not resolve a Jira project from "${target}".`);
  }

  return trimmed;
}

export function normalizeJiraIssueTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new MikaCliError("JIRA_ISSUE_TARGET_INVALID", "Jira issue target cannot be empty.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const match =
      url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/iu)?.[1] ??
      url.pathname.match(/\/issues\/([A-Z][A-Z0-9]+-\d+)/iu)?.[1];
    if (!match) {
      throw new MikaCliError("JIRA_ISSUE_TARGET_INVALID", `Could not resolve a Jira issue key from "${target}".`);
    }
    return match.toUpperCase();
  }

  if (!JIRA_ISSUE_KEY_REGEX.test(trimmed)) {
    throw new MikaCliError("JIRA_ISSUE_TARGET_INVALID", `Invalid Jira issue target "${target}". Expected an issue key like PROJ-123 or a Jira issue URL.`);
  }

  return trimmed.toUpperCase();
}

export function buildJiraIssueUrl(siteUrl: string, issueKey: string): string {
  return `${normalizeJiraSiteUrl(siteUrl)}/browse/${normalizeJiraIssueTarget(issueKey)}`;
}

export function buildJiraProjectUrl(siteUrl: string, projectKey: string): string {
  return `${normalizeJiraSiteUrl(siteUrl)}/jira/software/projects/${encodeURIComponent(normalizeJiraProjectTarget(projectKey))}`;
}

export function buildJiraIssuesJql(input: { project?: string; jql?: string; state?: string }): string {
  const explicit = input.jql?.trim();
  if (explicit) {
    return explicit;
  }

  const clauses: string[] = [];
  if (input.project?.trim()) {
    clauses.push(`project = "${normalizeJiraProjectTarget(input.project)}"`);
  } else {
    clauses.push("assignee = currentUser()");
  }

  const state = input.state?.trim().toLowerCase();
  if (state === "open" || state === "opened") {
    clauses.push('statusCategory != Done');
  } else if (state === "closed" || state === "done") {
    clauses.push('statusCategory = Done');
  }

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

export function adfDocumentFromPlainText(input?: string): Record<string, unknown> | undefined {
  const text = input?.trim();
  if (!text) {
    return undefined;
  }

  const paragraphs = text
    .split(/\n{2,}/u)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => ({
      type: "paragraph",
      content: [{ type: "text", text: chunk }],
    }));

  return {
    type: "doc",
    version: 1,
    content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export function adfToPlainText(input: unknown): string | undefined {
  const chunks: string[] = [];
  visitAdfNode(input, chunks);
  const text = chunks.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
  return text.length > 0 ? text : undefined;
}

function visitAdfNode(node: unknown, chunks: string[]): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof record.text === "string") {
    chunks.push(record.text);
  }

  if (!Array.isArray(record.content)) {
    return;
  }

  for (const child of record.content) {
    const beforeLength = chunks.length;
    visitAdfNode(child, chunks);
    const childRecord = child as { type?: unknown } | undefined;
    if (
      childRecord &&
      typeof childRecord === "object" &&
      (childRecord.type === "paragraph" || childRecord.type === "heading" || childRecord.type === "listItem")
    ) {
      if (chunks.length > beforeLength) {
        chunks.push("\n");
      }
    }
  }
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^\./u, "").trim().toLowerCase();
}

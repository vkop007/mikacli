import { AutoCliError } from "../../../errors.js";

const LINEAR_ISSUE_REFERENCE_REGEX = /([A-Z][A-Z0-9]+-\d+)/i;
const LINEAR_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeLinearToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new AutoCliError("LINEAR_TOKEN_INVALID", "Linear API key cannot be empty.");
  }

  return trimmed.replace(/^Bearer\s+/i, "");
}

export function normalizeLinearAccountName(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "default";
}

export function normalizeLinearReference(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AutoCliError("LINEAR_REFERENCE_INVALID", "Linear reference cannot be empty.");
  }

  if (LINEAR_UUID_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const issueKey = extractLinearIssueKey(trimmed);
  if (issueKey) {
    return issueKey;
  }

  return trimmed;
}

export function extractLinearIssueKey(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const urlMatch = trimmed.match(LINEAR_ISSUE_REFERENCE_REGEX);
  if (urlMatch?.[1]) {
    return urlMatch[1].toUpperCase();
  }

  if (LINEAR_ISSUE_REFERENCE_REGEX.test(trimmed)) {
    return trimmed.match(LINEAR_ISSUE_REFERENCE_REGEX)?.[1]?.toUpperCase();
  }

  return undefined;
}

export function sanitizeLinearSummaryText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}


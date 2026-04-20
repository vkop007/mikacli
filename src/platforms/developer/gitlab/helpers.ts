import { MikaCliError } from "../../../errors.js";

const DEFAULT_GITLAB_API_BASE_URL = "https://gitlab.com/api/v4";
const GITLAB_ID_REGEX = /([0-9]+|[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)+)/i;

export function normalizeGitLabState(value: string | undefined, fallback = "opened"): string {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed === "open") {
    return "opened";
  }

  return trimmed;
}

export function normalizeGitLabProjectTarget(target: string): string {
  const trimmed = target.trim();
  if (trimmed.length === 0) {
    throw new MikaCliError("GITLAB_PROJECT_TARGET_INVALID", "GitLab project target cannot be empty.");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "").replace(/\.git$/i, "");
    const projectPath = extractProjectPathFromUrlPath(pathname);
    if (!projectPath) {
      throw new MikaCliError("GITLAB_PROJECT_TARGET_INVALID", `Could not resolve a GitLab project from "${target}".`);
    }
    return projectPath;
  }

  const compact = trimmed.replace(/\/+$/, "").replace(/\.git$/i, "");
  if (/^[0-9]+$/.test(compact)) {
    return compact;
  }

  if (!GITLAB_ID_REGEX.test(compact)) {
    throw new MikaCliError("GITLAB_PROJECT_TARGET_INVALID", `Invalid GitLab project target "${target}". Expected a numeric ID, path_with_namespace, or project URL.`, {
      details: {
        target,
      },
    });
  }

  return compact;
}

export function encodeGitLabProjectTarget(target: string): string {
  return encodeURIComponent(normalizeGitLabProjectTarget(target));
}

export function buildGitLabProjectUrl(projectPath: string): string {
  return `${DEFAULT_GITLAB_API_BASE_URL.replace(/\/api\/v4$/, "")}/${projectPath}`;
}

export function resolveGitLabApiBaseUrl(input?: string | null): string {
  const candidate = normalizeBaseUrl(
    input?.trim() ||
      process.env.MIKACLI_GITLAB_API_BASE_URL?.trim() ||
      process.env.GITLAB_API_BASE_URL?.trim() ||
      DEFAULT_GITLAB_API_BASE_URL,
  );
  return candidate;
}

export function getGitLabStoredBaseUrl(metadata?: Record<string, unknown>): string | undefined {
  const value = metadata?.baseUrl;
  return typeof value === "string" && value.trim().length > 0 ? normalizeBaseUrl(value) : undefined;
}

export function getGitLabRuntimeBaseUrl(metadata?: Record<string, unknown>): string {
  return getGitLabStoredBaseUrl(metadata) ?? resolveGitLabApiBaseUrl();
}

export function getGitLabRuntimeOrigin(metadata?: Record<string, unknown>): string {
  return getGitLabRuntimeBaseUrl(metadata).replace(/\/api\/v4$/u, "");
}

export function getGitLabProjectDisplayName(project: { path_with_namespace?: string; name?: string; web_url?: string; id?: number | string }): string {
  return project.path_with_namespace ?? project.name ?? project.web_url ?? String(project.id ?? "unknown project");
}

function extractProjectPathFromUrlPath(pathname: string): string | undefined {
  const withoutLeading = pathname.replace(/^\/+/, "");
  if (withoutLeading.length === 0) {
    return undefined;
  }

  const [projectPath] = withoutLeading.split("/-/");
  if (!projectPath) {
    return undefined;
  }

  return decodeURIComponent(projectPath).replace(/\/+$/, "");
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (withProtocol.endsWith("/api/v4")) {
    return withProtocol;
  }

  return `${withProtocol}/api/v4`;
}

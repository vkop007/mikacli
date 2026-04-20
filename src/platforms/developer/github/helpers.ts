import { MikaCliError } from "../../../errors.js";

export function parseGitHubRepoTarget(target: string): { owner: string; repo: string; fullName: string } {
  const trimmed = target.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
  const [owner, repo] = trimmed.split("/", 2).map((value) => value?.trim());
  if (!owner || !repo) {
    throw new MikaCliError("GITHUB_REPO_TARGET_INVALID", `Invalid GitHub repository target "${target}". Expected owner/repo or a GitHub repository URL.`, {
      details: {
        target,
      },
    });
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

export function normalizeGitHubToken(token: string): string {
  const normalized = token.trim();
  if (!normalized) {
    throw new MikaCliError("GITHUB_TOKEN_INVALID", "GitHub token cannot be empty.");
  }

  return normalized;
}

export function buildGitHubRepoUrl(fullName: string): string {
  return `https://github.com/${fullName}`;
}

export function buildGitHubIssueUrl(fullName: string, issueNumber: number): string {
  return `https://github.com/${fullName}/issues/${issueNumber}`;
}

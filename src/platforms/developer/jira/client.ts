import { MikaCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { adfDocumentFromPlainText, buildJiraIssuesJql, normalizeJiraIssueTarget, normalizeJiraProjectTarget, normalizeJiraSiteUrl } from "./helpers.js";

type JiraAvatarUrls = Record<string, string>;

export type JiraUser = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active?: boolean;
  avatarUrls?: JiraAvatarUrls;
};

export type JiraIssueType = {
  id: string;
  name: string;
  description?: string;
  subtask?: boolean;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey?: string;
  simplified?: boolean;
  style?: string;
  avatarUrls?: JiraAvatarUrls;
  lead?: JiraUser;
  issueTypes?: JiraIssueType[];
};

export type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary?: string;
    description?: unknown;
    status?: {
      name?: string;
      statusCategory?: {
        name?: string;
      };
    };
    issuetype?: JiraIssueType;
    project?: {
      id?: string;
      key?: string;
      name?: string;
    };
    assignee?: JiraUser | null;
    reporter?: JiraUser | null;
    labels?: string[];
    priority?: {
      name?: string;
    };
    created?: string;
    updated?: string;
  };
};

type JiraProjectSearchResponse = {
  values?: JiraProject[];
};

type JiraIssueSearchResponse = {
  issues?: JiraIssue[];
};

type JiraIssueCreateResponse = {
  id: string;
  key: string;
  self?: string;
};

type JiraProjectStatusesResponseItem = {
  id: string;
  name: string;
  subtask?: boolean;
};

const JIRA_DEFAULT_FIELDS = [
  "summary",
  "description",
  "status",
  "issuetype",
  "project",
  "assignee",
  "reporter",
  "labels",
  "priority",
  "created",
  "updated",
] as const;

export class JiraWebClient {
  readonly siteUrl: string;

  constructor(
    private readonly http: SessionHttpClient,
    siteUrl: string,
  ) {
    this.siteUrl = normalizeJiraSiteUrl(siteUrl);
  }

  async getViewer(): Promise<JiraUser> {
    return this.request<JiraUser>("/rest/api/3/myself");
  }

  async listProjects(input: { query?: string; limit?: number }): Promise<JiraProject[]> {
    const url = new URL(`${this.siteUrl}/rest/api/3/project/search`);
    url.searchParams.set("maxResults", String(clamp(input.limit ?? 20, 1, 100)));
    if (input.query?.trim()) {
      url.searchParams.set("query", input.query.trim());
    }

    const response = await this.requestAbsolute<JiraProjectSearchResponse>(url.toString());
    return response.values ?? [];
  }

  async getProject(target: string): Promise<JiraProject> {
    return this.request<JiraProject>(`/rest/api/3/project/${encodeURIComponent(normalizeJiraProjectTarget(target))}`);
  }

  async listProjectIssueTypes(project: string): Promise<JiraIssueType[]> {
    const rows = await this.request<JiraProjectStatusesResponseItem[]>(`/rest/api/3/project/${encodeURIComponent(normalizeJiraProjectTarget(project))}/statuses`);
    return rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      subtask: Boolean(row.subtask),
    }));
  }

  async searchIssues(input: { project?: string; jql?: string; state?: string; limit?: number }): Promise<JiraIssue[]> {
    const response = await this.request<JiraIssueSearchResponse>("/rest/api/3/search", {
      method: "POST",
      body: {
        jql: buildJiraIssuesJql(input),
        maxResults: clamp(input.limit ?? 20, 1, 100),
        fields: [...JIRA_DEFAULT_FIELDS],
      },
      expectedStatus: [200],
    });
    return response.issues ?? [];
  }

  async getIssue(target: string): Promise<JiraIssue> {
    const url = new URL(`${this.siteUrl}/rest/api/3/issue/${encodeURIComponent(normalizeJiraIssueTarget(target))}`);
    url.searchParams.set("fields", JIRA_DEFAULT_FIELDS.join(","));
    return this.requestAbsolute<JiraIssue>(url.toString());
  }

  async createIssue(input: { project: string; summary: string; description?: string; issueType?: string }): Promise<JiraIssue> {
    const projectKey = normalizeJiraProjectTarget(input.project);
    const availableTypes = await this.listProjectIssueTypes(projectKey);
    const selectedType = selectIssueType(availableTypes, input.issueType);
    const created = await this.request<JiraIssueCreateResponse>("/rest/api/3/issue", {
      method: "POST",
      body: {
        fields: {
          project: { key: projectKey },
          summary: input.summary,
          issuetype: { id: selectedType.id },
          ...(input.description?.trim() ? { description: adfDocumentFromPlainText(input.description) } : {}),
        },
      },
      expectedStatus: [201],
    });

    return this.getIssue(created.key);
  }

  private async request<T>(
    path: string,
    input: {
      method?: string;
      body?: Record<string, unknown>;
      expectedStatus?: number[];
    } = {},
  ): Promise<T> {
    return this.requestAbsolute<T>(`${this.siteUrl}${path}`, input);
  }

  private async requestAbsolute<T>(
    url: string,
    input: {
      method?: string;
      body?: Record<string, unknown>;
      expectedStatus?: number[];
    } = {},
  ): Promise<T> {
    try {
      const { data } = await this.http.requestWithResponse<string>(url, {
        method: input.method ?? "GET",
        responseType: "text",
        expectedStatus: input.expectedStatus ?? [200],
        headers: {
          accept: "application/json",
          ...(input.body ? { "content-type": "application/json" } : {}),
          "x-atlassian-token": "no-check",
          "x-requested-with": "XMLHttpRequest",
          "user-agent": "MikaCLI",
        },
        ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      });

      const text = data.trim();
      if (!text) {
        return {} as T;
      }

      if (text.startsWith("<")) {
        throw new MikaCliError("JIRA_SESSION_INVALID", "Jira redirected the saved web session to an HTML page. Re-import fresh cookies.", {
          details: {
            url,
            preview: text.slice(0, 200),
          },
        });
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new MikaCliError("JIRA_RESPONSE_INVALID", "Jira returned a non-JSON response.", {
          cause: error,
          details: {
            url,
            preview: text.slice(0, 200),
          },
        });
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): MikaCliError {
    if (!(error instanceof MikaCliError)) {
      return new MikaCliError("JIRA_REQUEST_FAILED", "Jira request failed.", { cause: error });
    }

    if (error.code !== "HTTP_REQUEST_FAILED") {
      return error;
    }

    const status = typeof error.details?.status === "number" ? error.details.status : undefined;
    const body = typeof error.details?.body === "string" ? error.details.body : "";
    const message = extractJiraUpstreamMessage(body);

    const code =
      status === 400 || status === 422 ? "JIRA_VALIDATION_FAILED"
      : status === 401 ? "JIRA_SESSION_INVALID"
      : status === 403 ? "JIRA_FORBIDDEN"
      : status === 404 ? "JIRA_NOT_FOUND"
      : status === 429 ? "JIRA_RATE_LIMITED"
      : "JIRA_REQUEST_FAILED";

    const friendly =
      code === "JIRA_SESSION_INVALID" ? "Jira rejected the saved web session. Re-import fresh cookies."
      : code === "JIRA_FORBIDDEN" ? "Jira denied access to that resource."
      : code === "JIRA_NOT_FOUND" ? "Jira could not find that resource."
      : code === "JIRA_RATE_LIMITED" ? "Jira rate limited the request. Try again later."
      : code === "JIRA_VALIDATION_FAILED" ? `Jira rejected the request: ${message}`
      : `Jira request failed${status ? ` with HTTP ${status}` : ""}.`;

    return new MikaCliError(code, friendly, {
      cause: error,
      details: {
        status,
        upstreamMessage: message,
      },
    });
  }
}

function selectIssueType(issueTypes: JiraIssueType[], preferred?: string): JiraIssueType {
  const normalizedPreferred = preferred?.trim().toLowerCase();
  if (normalizedPreferred) {
    const match = issueTypes.find((issueType) =>
      issueType.id.toLowerCase() === normalizedPreferred || issueType.name.toLowerCase() === normalizedPreferred,
    );
    if (match) {
      return match;
    }
  }

  const preferredDefaults = issueTypes.find((issueType) => issueType.name.toLowerCase() === "task" && !issueType.subtask);
  if (preferredDefaults) {
    return preferredDefaults;
  }

  const firstNonSubtask = issueTypes.find((issueType) => !issueType.subtask);
  if (firstNonSubtask) {
    return firstNonSubtask;
  }

  if (issueTypes[0]) {
    return issueTypes[0];
  }

  throw new MikaCliError("JIRA_ISSUE_TYPE_NOT_FOUND", "Jira did not return any issue types for that project.");
}

function extractJiraUpstreamMessage(body: string): string {
  if (!body.trim()) {
    return "Unknown Jira error";
  }

  try {
    const parsed = JSON.parse(body) as {
      errorMessages?: string[];
      errors?: Record<string, string>;
      message?: string;
    };
    const messages = [
      ...(Array.isArray(parsed.errorMessages) ? parsed.errorMessages : []),
      ...Object.values(parsed.errors ?? {}),
      typeof parsed.message === "string" ? parsed.message : undefined,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    return messages.join(" ").trim() || body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

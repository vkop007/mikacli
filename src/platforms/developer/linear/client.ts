import { AutoCliError } from "../../../errors.js";

const LINEAR_API_URL = "https://api.linear.app/graphql";

type FetchLike = typeof fetch;

export type LinearUser = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type LinearTeam = {
  id: string;
  name: string;
  key: string;
  description?: string | null;
};

export type LinearProject = {
  id: string;
  name: string;
  description?: string | null;
};

export type LinearState = {
  id: string;
  name: string;
};

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  state?: LinearState | null;
  team?: LinearTeam | null;
};

export type LinearComment = {
  id: string;
  body?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: LinearUser | null;
};

type GraphQLError = {
  message: string;
  extensions?: {
    code?: string;
  };
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLError[];
};

export class LinearApiClient {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(input: { apiKey: string; fetchImpl?: FetchLike }) {
    this.apiKey = input.apiKey;
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  async getViewer(): Promise<LinearUser> {
    return this.request<{ viewer: LinearUser }>(
      `query Viewer {
        viewer {
          id
          name
          email
        }
      }`,
    ).then((response) => response.viewer);
  }

  async listTeams(input: { limit?: number }): Promise<LinearTeam[]> {
    return this.request<{ teams: { nodes: LinearTeam[] } }>(
      `query Teams($first: Int) {
        teams(first: $first) {
          nodes {
            id
            name
            key
            description
          }
        }
      }`,
      {
        first: clamp(input.limit ?? 20, 1, 100),
      },
    ).then((response) => response.teams.nodes);
  }

  async listProjects(input: { limit?: number }): Promise<LinearProject[]> {
    return this.request<{ projects: { nodes: LinearProject[] } }>(
      `query Projects($first: Int) {
        projects(first: $first) {
          nodes {
            id
            name
            description
          }
        }
      }`,
      {
        first: clamp(input.limit ?? 20, 1, 100),
      },
    ).then((response) => response.projects.nodes);
  }

  async listIssues(input: { teamId?: string; limit?: number }): Promise<LinearIssue[]> {
    return this.request<{ issues: { nodes: LinearIssue[] } }>(
      `query Issues($first: Int, $filter: IssueFilter) {
        issues(first: $first, filter: $filter) {
          nodes {
            id
            identifier
            title
            description
            createdAt
            updatedAt
            state {
              id
              name
            }
            team {
              id
              name
              key
              description
            }
          }
        }
      }`,
      {
        first: clamp(input.limit ?? 20, 1, 100),
        filter: input.teamId
          ? {
              team: {
                id: {
                  eq: input.teamId,
                },
              },
            }
          : undefined,
      },
    ).then((response) => response.issues.nodes);
  }

  async getIssue(issueIdOrKey: string): Promise<LinearIssue> {
    return this.request<{ issue: LinearIssue }>(
      `query Issue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          createdAt
          updatedAt
          state {
            id
            name
          }
          team {
            id
            name
            key
            description
          }
        }
      }`,
      {
        id: issueIdOrKey,
      },
    ).then((response) => response.issue);
  }

  async createIssue(input: { teamId: string; title: string; description?: string }): Promise<LinearIssue> {
    return this.request<{ issueCreate: { success: boolean; issue: LinearIssue } }>(
      `mutation IssueCreate($teamId: String!, $title: String!, $description: String) {
        issueCreate(
          input: {
            teamId: $teamId
            title: $title
            description: $description
          }
        ) {
          success
          issue {
            id
            identifier
            title
            description
            createdAt
            updatedAt
            state {
              id
              name
            }
            team {
              id
              name
              key
              description
            }
          }
        }
      }`,
      {
        teamId: input.teamId,
        title: input.title,
        description: input.description ?? undefined,
      },
    ).then((response) => response.issueCreate.issue);
  }

  async updateIssue(input: { id: string; title?: string; description?: string; stateId?: string }): Promise<LinearIssue> {
    return this.request<{ issueUpdate: { success: boolean; issue: LinearIssue } }>(
      `mutation IssueUpdate($id: String!, $title: String, $description: String, $stateId: String) {
        issueUpdate(
          id: $id
          input: {
            title: $title
            description: $description
            stateId: $stateId
          }
        ) {
          success
          issue {
            id
            identifier
            title
            description
            createdAt
            updatedAt
            state {
              id
              name
            }
            team {
              id
              name
              key
              description
            }
          }
        }
      }`,
      {
        id: input.id,
        title: input.title,
        description: input.description,
        stateId: input.stateId,
      },
    ).then((response) => response.issueUpdate.issue);
  }

  async createComment(input: { issueId: string; body: string }): Promise<LinearComment> {
    return this.request<{ commentCreate: { success: boolean; comment: LinearComment } }>(
      `mutation CommentCreate($issueId: String!, $body: String!) {
        commentCreate(
          input: {
            issueId: $issueId
            body: $body
          }
        ) {
          success
          comment {
            id
            body
            createdAt
            updatedAt
            user {
              id
              name
              email
            }
          }
        }
      }`,
      {
        issueId: input.issueId,
        body: input.body,
      },
    ).then((response) => response.commentCreate.comment);
  }

  private async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(LINEAR_API_URL, {
      method: "POST",
      headers: {
        authorization: this.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: variables ?? {},
      }),
    });

    const payload = (await response.json().catch(() => undefined)) as GraphQLResponse<T> | undefined;

    if (!response.ok) {
      throw this.toLinearError(response.status, response.statusText, payload);
    }

    if (payload?.errors?.length) {
      throw this.toLinearGraphQLError(payload.errors);
    }

    if (!payload?.data) {
      throw new AutoCliError("LINEAR_EMPTY_RESPONSE", "Linear returned an empty response.");
    }

    return payload.data;
  }

  private toLinearError(status: number, statusText: string, payload?: GraphQLResponse<unknown>): AutoCliError {
    const errors = payload?.errors ?? [];
    const firstError = errors[0];
    const code =
      status === 401 ? "LINEAR_TOKEN_INVALID"
      : status === 403 ? "LINEAR_FORBIDDEN"
      : status === 404 ? "LINEAR_NOT_FOUND"
      : status === 429 ? "LINEAR_RATE_LIMITED"
      : "LINEAR_REQUEST_FAILED";

    return new AutoCliError(code, this.buildErrorMessage(code, status, statusText, firstError), {
      details: {
        status,
        statusText,
        upstreamCode: firstError?.extensions?.code,
        upstreamMessage: firstError?.message,
      },
    });
  }

  private toLinearGraphQLError(errors: GraphQLError[]): AutoCliError {
    const firstError = errors[0];
    const upstreamCode = firstError?.extensions?.code;
    const code =
      upstreamCode === "UNAUTHENTICATED" ? "LINEAR_TOKEN_INVALID"
      : upstreamCode === "FORBIDDEN" ? "LINEAR_FORBIDDEN"
      : upstreamCode === "NOT_FOUND" ? "LINEAR_NOT_FOUND"
      : upstreamCode === "RATE_LIMITED" ? "LINEAR_RATE_LIMITED"
      : upstreamCode === "VALIDATION_FAILED" ? "LINEAR_VALIDATION_FAILED"
      : "LINEAR_GRAPHQL_ERROR";

    return new AutoCliError(code, this.buildGraphQLErrorMessage(code, firstError?.message), {
      details: {
        upstreamCode,
        upstreamMessage: firstError?.message,
      },
    });
  }

  private buildErrorMessage(code: string, status: number, statusText: string, error?: GraphQLError): string {
    const upstreamMessage = error?.message;
    switch (code) {
      case "LINEAR_TOKEN_INVALID":
        return "Linear rejected the supplied token.";
      case "LINEAR_FORBIDDEN":
        return "Linear denied access. Make sure the token has permission to the workspace.";
      case "LINEAR_NOT_FOUND":
        return "Linear could not find that resource.";
      case "LINEAR_RATE_LIMITED":
        return "Linear rate limited the request. Try again in a moment.";
      default:
        return upstreamMessage ? `Linear API request failed: ${upstreamMessage}` : `Linear API request failed with HTTP ${status} ${statusText}.`;
    }
  }

  private buildGraphQLErrorMessage(code: string, upstreamMessage?: string): string {
    switch (code) {
      case "LINEAR_TOKEN_INVALID":
        return "Linear rejected the supplied token.";
      case "LINEAR_FORBIDDEN":
        return "Linear denied access. Make sure the token has permission to the workspace.";
      case "LINEAR_NOT_FOUND":
        return "Linear could not find that resource.";
      case "LINEAR_RATE_LIMITED":
        return "Linear rate limited the request. Try again in a moment.";
      case "LINEAR_VALIDATION_FAILED":
        return upstreamMessage ? `Linear rejected the request: ${upstreamMessage}` : "Linear rejected the request.";
      default:
        return upstreamMessage ? `Linear GraphQL request failed: ${upstreamMessage}` : "Linear GraphQL request failed.";
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

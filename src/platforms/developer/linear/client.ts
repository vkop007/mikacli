import { AutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const LINEAR_WEB_ORIGIN = "https://linear.app";
const LINEAR_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

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

export class LinearWebClient {
  constructor(private readonly http: SessionHttpClient) {}

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
        commentCreate(input: { issueId: $issueId, body: $body }) {
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
    let response: GraphQLResponse<T>;
    try {
      response = await this.http.request<GraphQLResponse<T>>(LINEAR_GRAPHQL_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin: LINEAR_WEB_ORIGIN,
          referer: `${LINEAR_WEB_ORIGIN}/`,
          "user-agent": LINEAR_USER_AGENT,
        },
        body: JSON.stringify({
          query,
          variables: variables ?? {},
        }),
      });
    } catch (error) {
      throw this.toLinearError(error);
    }

    if (Array.isArray(response.errors) && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError?.extensions?.code;
      const message = firstError?.message || "Unknown Linear GraphQL error.";

      if (code === "AUTHENTICATION_REQUIRED" || /unauth|authenticate|session/i.test(message)) {
        throw new AutoCliError("LINEAR_SESSION_INVALID", "Linear rejected the saved web session. Re-import fresh cookies.", {
          details: {
            code,
            message,
          },
        });
      }

      throw new AutoCliError("LINEAR_GRAPHQL_FAILED", `Linear rejected the request: ${message}`, {
        details: {
          code,
          message,
        },
      });
    }

    if (!response.data) {
      throw new AutoCliError("LINEAR_GRAPHQL_EMPTY", "Linear returned an empty GraphQL response.");
    }

    return response.data;
  }

  private toLinearError(error: unknown): AutoCliError {
    if (error instanceof AutoCliError && error.code === "HTTP_REQUEST_FAILED") {
      const status = typeof error.details?.status === "number" ? error.details.status : undefined;
      const body = typeof error.details?.body === "string" ? error.details.body : undefined;

      if (status === 401 || status === 403) {
        return new AutoCliError("LINEAR_SESSION_INVALID", "Linear rejected the saved web session. Re-import fresh cookies.", {
          details: {
            status,
            body,
          },
        });
      }

      return new AutoCliError("LINEAR_REQUEST_FAILED", "Linear request failed.", {
        details: {
          status,
          body,
        },
        cause: error,
      });
    }

    if (error instanceof AutoCliError) {
      return error;
    }

    return new AutoCliError("LINEAR_REQUEST_FAILED", error instanceof Error ? error.message : "Linear request failed.", {
      cause: error,
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

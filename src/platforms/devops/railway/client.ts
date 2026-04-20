import { MikaCliError } from "../../../errors.js";
import { isObject } from "../shared/rest.js";

export interface RailwayUser {
  id?: string;
  email?: string;
  name?: string;
  username?: string;
  avatar?: string;
  createdAt?: string;
}

export interface RailwayProject {
  id?: string;
  name?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  teamId?: string;
  isPublic?: boolean;
  isTempProject?: boolean;
}

export interface RailwayService {
  id?: string;
  name?: string;
  projectId?: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

export class RailwayApiClient {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async getViewer(): Promise<RailwayUser> {
    const payload = await this.request<{ me?: RailwayUser }>(
      `query me {
        me {
          id
          email
          name
          username
          avatar
          createdAt
        }
      }`,
    );

    return payload.me ?? {};
  }

  async listProjects(limit = 20): Promise<RailwayProject[]> {
    const payload = await this.request<{ projects?: { edges?: Array<{ node?: RailwayProject }> } }>(
      `query projects($first: Int) {
        projects(first: $first) {
          edges {
            node {
              id
              name
              description
              createdAt
              updatedAt
              teamId
              isPublic
              isTempProject
            }
          }
        }
      }`,
      { first: Math.min(limit, 100) },
    );

    return extractNodes<RailwayProject>(payload.projects);
  }

  async getProject(id: string): Promise<RailwayProject> {
    const payload = await this.request<{ project?: RailwayProject }>(
      `query project($id: String!) {
        project(id: $id) {
          id
          name
          description
          createdAt
          updatedAt
          teamId
          isPublic
          isTempProject
        }
      }`,
      { id },
    );

    return payload.project ?? {};
  }

  async getService(id: string): Promise<RailwayService> {
    const payload = await this.request<{ service?: RailwayService }>(
      `query service($id: String!) {
        service(id: $id) {
          id
          name
          projectId
          icon
          createdAt
          updatedAt
        }
      }`,
      { id },
    );

    return payload.service ?? {};
  }

  private async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "MikaCLI/0.1 (+https://github.com/vkop007/mikacli)",
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = (await response.json().catch(() => undefined)) as GraphQlResponse<T> | undefined;
    if (!response.ok || (payload?.errors?.length ?? 0) > 0) {
      const message =
        payload?.errors?.map((entry) => entry.message).find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?? `Railway API request failed with status ${response.status}.`;
      throw new MikaCliError("RAILWAY_API_ERROR", message);
    }

    if (!payload?.data) {
      throw new MikaCliError("RAILWAY_API_ERROR", "Railway returned an empty response.");
    }

    return payload.data;
  }
}

function extractNodes<T>(value: unknown): T[] {
  if (!isObject(value) || !Array.isArray(value.edges)) {
    return [];
  }

  return value.edges
    .map((entry) => (isObject(entry) && isObject(entry.node) ? (entry.node as T) : undefined))
    .filter((entry): entry is T => entry !== undefined);
}

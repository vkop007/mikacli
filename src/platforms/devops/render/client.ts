import { BearerJsonClient, extractArray, isObject } from "../shared/rest.js";

export interface RenderUser {
  id?: string;
  email?: string;
  name?: string;
}

export interface RenderService {
  id?: string;
  slug?: string;
  name?: string;
  type?: string;
  serviceDetails?: {
    env?: string;
    plan?: string;
    url?: string;
  };
  suspended?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RenderProject {
  id?: string;
  name?: string;
  slug?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RenderEnvGroup {
  id?: string;
  name?: string;
  envVarCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export class RenderApiClient {
  private readonly client: BearerJsonClient;

  constructor(token: string, fetchImpl?: typeof fetch) {
    this.client = new BearerJsonClient({
      baseUrl: "https://api.render.com/v1",
      token,
      errorCode: "RENDER_API_ERROR",
      fetchImpl,
    });
  }

  async getUser(): Promise<RenderUser> {
    const payload = await this.client.request<unknown>("/users");
    if (isObject(payload)) {
      return payload as RenderUser;
    }

    return {};
  }

  async listServices(limit = 20): Promise<RenderService[]> {
    const payload = await this.client.request<unknown>(`/services?limit=${Math.min(limit, 100)}`);
    return extractArray<RenderService>(payload, ["services"]);
  }

  async listProjects(limit = 20): Promise<RenderProject[]> {
    const payload = await this.client.request<unknown>(`/projects?limit=${Math.min(limit, 100)}`);
    return extractArray<RenderProject>(payload, ["projects"]);
  }

  async listEnvGroups(limit = 20): Promise<RenderEnvGroup[]> {
    const payload = await this.client.request<unknown>(`/env-groups?limit=${Math.min(limit, 100)}`);
    return extractArray<RenderEnvGroup>(payload, ["envGroups", "env_groups"]);
  }
}

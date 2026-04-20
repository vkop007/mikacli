import { MikaCliError } from "../../../errors.js";

export interface VercelUser {
  id: string;
  username?: string;
  email?: string;
  name?: string;
}

export interface VercelTeam {
  id: string;
  slug?: string;
  name: string;
}

export interface VercelProject {
  id: string;
  name: string;
  framework?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VercelDeployment {
  uid: string;
  name?: string;
  url?: string;
  state?: string;
  createdAt?: number;
  target?: string;
  projectId?: string;
}

type VercelEnvelope<T> = {
  error?: {
    message?: string;
  };
  user?: T;
  teams?: T;
  projects?: T;
  deployments?: T;
};

export class VercelApiClient {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async getUser(): Promise<VercelUser> {
    const payload = await this.request<VercelUser | { user?: VercelUser }>("/v2/user");
    if (isObject(payload) && isObject(payload.user)) {
      return payload.user as VercelUser;
    }

    if (isObject(payload)) {
      return payload as VercelUser;
    }

    throw new MikaCliError("VERCEL_API_ERROR", "Vercel returned an invalid user response.");
  }

  async listTeams(limit = 20): Promise<VercelTeam[]> {
    const payload = await this.request<VercelEnvelope<VercelTeam[]> | VercelTeam[]>(`/v2/teams?limit=${Math.min(limit, 100)}`);
    return extractArray(payload, "teams");
  }

  async listProjects(limit = 20): Promise<VercelProject[]> {
    const payload = await this.request<VercelEnvelope<VercelProject[]> | VercelProject[]>(`/v9/projects?limit=${Math.min(limit, 100)}`);
    return extractArray(payload, "projects");
  }

  async listDeployments(limit = 20, projectId?: string): Promise<VercelDeployment[]> {
    const search = new URLSearchParams({
      limit: String(Math.min(limit, 100)),
      ...(projectId ? { projectId } : {}),
    });
    const payload = await this.request<VercelEnvelope<VercelDeployment[]> | VercelDeployment[]>(`/v6/deployments?${search.toString()}`);
    return extractArray(payload, "deployments");
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`https://api.vercel.com${path}`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "MikaCLI/0.1 (+https://github.com/vkop007/mikacli)",
      },
    });

    const payload = (await response.json().catch(() => undefined)) as VercelEnvelope<T> | T | undefined;
    if (!response.ok) {
      const message = isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string"
        ? payload.error.message
        : `Vercel API request failed with status ${response.status}.`;
      throw new MikaCliError("VERCEL_API_ERROR", message, {
        details: {
          status: response.status,
          path,
        },
      });
    }

    if (payload === undefined) {
      throw new MikaCliError("VERCEL_API_ERROR", "Vercel returned an empty response.", {
        details: { path },
      });
    }

    return payload as T;
  }
}

function extractArray<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (isObject(payload) && Array.isArray(payload[key])) {
    return payload[key] as T[];
  }

  return [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

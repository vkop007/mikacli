import { MikaCliError } from "../../../errors.js";

export interface SupabaseOrganization {
  id: string;
  name?: string;
  slug?: string;
  plan?: string;
}

export interface SupabaseProject {
  id?: string;
  ref?: string;
  name: string;
  region?: string;
  status?: string;
  organization_id?: string;
}

export interface SupabaseFunction {
  id?: string;
  slug?: string;
  name?: string;
  version?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export class SupabaseApiClient {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async listOrganizations(): Promise<SupabaseOrganization[]> {
    const payload = await this.request<unknown>("/organizations");
    return extractArray<SupabaseOrganization>(payload, ["organizations"]);
  }

  async listProjects(): Promise<SupabaseProject[]> {
    const payload = await this.request<unknown>("/projects");
    return extractArray<SupabaseProject>(payload, ["projects"]);
  }

  async listFunctions(projectRef: string): Promise<SupabaseFunction[]> {
    const payload = await this.request<unknown>(`/projects/${encodeURIComponent(projectRef)}/functions`);
    return extractArray<SupabaseFunction>(payload, ["functions"]);
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`https://api.supabase.com/v1${path}`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "MikaCLI/0.1 (+https://github.com/vkop007/mikacli)",
      },
    });

    const payload = (await response.json().catch(() => undefined)) as T | { message?: string; error?: string } | undefined;
    if (!response.ok) {
      const message =
        (isObject(payload) && typeof payload.message === "string" ? payload.message : undefined)
        ?? (isObject(payload) && typeof payload.error === "string" ? payload.error : undefined)
        ?? `Supabase API request failed with status ${response.status}.`;
      throw new MikaCliError("SUPABASE_API_ERROR", message, {
        details: {
          status: response.status,
          path,
        },
      });
    }

    if (payload === undefined) {
      throw new MikaCliError("SUPABASE_API_ERROR", "Supabase returned an empty response.", {
        details: { path },
      });
    }

    return payload as T;
  }
}

function extractArray<T>(payload: unknown, keys: readonly string[]): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (isObject(payload)) {
    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }
  }

  return [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

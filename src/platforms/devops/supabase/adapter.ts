import { MikaCliError } from "../../../errors.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { SupabaseApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { SupabaseFunction, SupabaseOrganization, SupabaseProject } from "./client.js";

type ActiveSupabaseConnection = LoadedApiKeyConnection & {
  client: SupabaseApiClient;
  organizations: SupabaseOrganization[];
  projects: SupabaseProject[];
};

export class SupabaseAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "supabase" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new SupabaseApiClient(token);
    const organizations = await client.listOrganizations();
    const projects = await client.listProjects();
    const claims = decodeJwtClaims(token);
    const user = this.toSessionUser(claims, organizations, projects);
    const account = this.resolveAccountName(input.account, [user?.username, organizations[0]?.slug, organizations[0]?.name, projects[0]?.name]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "supabase",
      user,
      status: this.activeStatus("Supabase management token validated."),
      metadata: {
        claims,
        organizations: organizations.map((entry) => this.summarizeOrganization(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved Supabase token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.buildUserPayload(user, claims),
        organizations: organizations.map((entry) => this.summarizeOrganization(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new SupabaseApiClient(loaded.token);

    try {
      const organizations = await client.listOrganizations();
      const projects = await client.listProjects();
      const claims = decodeJwtClaims(loaded.token);
      const user = this.toSessionUser(claims, organizations, projects) ?? loaded.user;
      const status = this.activeStatus("Supabase management token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          claims,
          organizations: organizations.map((entry) => this.summarizeOrganization(entry)),
          projects: projects.map((entry) => this.summarizeProject(entry)),
        },
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Supabase token validation failed.";
      const status = this.expiredStatus(message, "SUPABASE_API_ERROR");
      const sessionPath = await this.persistTokenConnection(loaded, { status });
      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user: loaded.user,
      });
    }
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    return this.buildStatusAction(await this.getStatus(account));
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(account);
    return this.buildActionResult({
      account: active.account,
      action: "me",
      message: "Loaded Supabase workspace summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.buildUserPayload(active.user, active.metadata?.claims as Record<string, unknown> | undefined),
        organizations: active.organizations.map((entry) => this.summarizeOrganization(entry)),
        projects: active.projects.map((entry) => this.summarizeProject(entry)),
      },
    });
  }

  async organizations(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.organizations.slice(0, input.limit ?? 20).map((entry) => this.summarizeOrganization(entry));
    return this.buildActionResult({
      account: active.account,
      action: "organizations",
      message: `Loaded ${items.length} Supabase organization${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        organizations: items,
      },
    });
  }

  async projects(input: { account?: string; limit?: number; organization?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const filtered = typeof input.organization === "string" && input.organization.trim().length > 0
      ? active.projects.filter((project) => project.organization_id === input.organization)
      : active.projects;
    const items = filtered.slice(0, input.limit ?? 20).map((entry) => this.summarizeProject(entry));
    return this.buildActionResult({
      account: active.account,
      action: "projects",
      message: `Loaded ${items.length} Supabase project${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        projects: items,
      },
    });
  }

  async functions(input: { account?: string; project: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const project = await this.resolveProject(active.projects, input.project);
    const functions = await active.client.listFunctions(project.ref ?? project.id ?? "");
    return this.buildActionResult({
      account: active.account,
      action: "functions",
      message: `Loaded ${functions.length} Supabase function${functions.length === 1 ? "" : "s"} for ${project.name}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        project: this.summarizeProject(project),
        functions: functions.map((entry) => this.summarizeFunction(entry, project)),
      },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveSupabaseConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new SupabaseApiClient(loaded.token);
    const organizations = await client.listOrganizations();
    const projects = await client.listProjects();
    const claims = decodeJwtClaims(loaded.token);
    const user = this.toSessionUser(claims, organizations, projects) ?? loaded.user;
    const status = this.activeStatus("Supabase management token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        claims,
        organizations: organizations.map((entry) => this.summarizeOrganization(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
    });

    return {
      ...loaded,
      path,
      user,
      metadata: {
        ...(loaded.metadata ?? {}),
        claims,
        organizations: organizations.map((entry) => this.summarizeOrganization(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
      client,
      organizations,
      projects,
    };
  }

  private async resolveProject(projects: SupabaseProject[], target: string): Promise<SupabaseProject> {
    const normalized = target.trim();
    if (!normalized) {
      throw new MikaCliError("SUPABASE_PROJECT_REQUIRED", "Supabase functions require a project name, ref, or ID.");
    }

    const match = projects.find((project) =>
      project.id === normalized ||
      project.ref === normalized ||
      project.name.toLowerCase() === normalized.toLowerCase(),
    );

    if (!match) {
      throw new MikaCliError("SUPABASE_PROJECT_NOT_FOUND", `No Supabase project matched "${target}".`);
    }

    if (!(match.ref ?? match.id)) {
      throw new MikaCliError("SUPABASE_PROJECT_REFERENCE_MISSING", `Supabase project "${match.name}" does not include a project reference.`);
    }

    return match;
  }

  private toSessionUser(
    claims: Record<string, unknown> | undefined,
    organizations: SupabaseOrganization[],
    projects: SupabaseProject[],
  ): SessionUser | undefined {
    const email = readString(claims, ["email"]);
    const username = readString(claims, ["preferred_username", "user_name", "sub"]) ?? email?.split("@")[0];
    const displayName =
      readString(claims, ["name", "full_name"])
      ?? organizations[0]?.name
      ?? projects[0]?.name
      ?? email
      ?? username;

    if (!displayName && !username && !email) {
      return undefined;
    }

    return {
      id: readString(claims, ["sub"]),
      username,
      displayName,
    };
  }

  private buildUserPayload(user: SessionUser | undefined, claims: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!user && !claims) {
      return undefined;
    }

    return {
      id: user?.id,
      username: user?.username,
      displayName: user?.displayName,
      email: readString(claims, ["email"]),
    };
  }

  private summarizeOrganization(organization: SupabaseOrganization): Record<string, unknown> {
    return {
      id: organization.id,
      name: organization.name ?? organization.slug ?? organization.id,
      slug: organization.slug,
      plan: organization.plan,
      url: organization.slug ? `https://supabase.com/dashboard/org/${organization.slug}` : undefined,
    };
  }

  private summarizeProject(project: SupabaseProject): Record<string, unknown> {
    const ref = project.ref ?? project.id;
    return {
      id: ref,
      ref,
      name: project.name,
      status: project.status,
      region: project.region,
      organizationName: project.organization_id,
      url: ref ? `https://supabase.com/dashboard/project/${ref}` : undefined,
    };
  }

  private summarizeFunction(fn: SupabaseFunction, project: SupabaseProject): Record<string, unknown> {
    const ref = project.ref ?? project.id;
    return {
      id: fn.id ?? fn.slug,
      name: fn.name ?? fn.slug ?? fn.id,
      status: fn.status,
      version: typeof fn.version === "number" ? String(fn.version) : undefined,
      projectName: project.name,
      projectRef: ref,
      createdAt: fn.created_at,
      updatedAt: fn.updated_at,
      url: ref && (fn.slug ?? fn.name) ? `https://supabase.com/dashboard/project/${ref}/functions/${fn.slug ?? fn.name}` : undefined,
    };
  }
}

export const supabaseAdapter = new SupabaseAdapter();

function decodeJwtClaims(token: string): Record<string, unknown> | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return undefined;
  }

  try {
    const payload = parts[1];
    if (!payload) {
      return undefined;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function readString(record: Record<string, unknown> | undefined, keys: readonly string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

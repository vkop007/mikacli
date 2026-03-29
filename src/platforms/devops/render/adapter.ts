import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { RenderApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { RenderEnvGroup, RenderProject, RenderService, RenderUser } from "./client.js";

type ActiveRenderConnection = LoadedApiKeyConnection & {
  client: RenderApiClient;
  viewer: RenderUser;
  services: RenderService[];
  projects: RenderProject[];
  envGroups: RenderEnvGroup[];
};

export class RenderAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "render" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new RenderApiClient(token);
    const viewer = await client.getUser();
    const services = await client.listServices(20).catch(() => []);
    const projects = await client.listProjects(20).catch(() => []);
    const envGroups = await client.listEnvGroups(20).catch(() => []);
    const user = this.toSessionUser(viewer);
    const account = this.resolveAccountName(input.account, [user?.username, viewer.email?.split("@")[0], viewer.id]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "render",
      user,
      status: this.activeStatus("Render API token validated."),
      metadata: {
        user: this.summarizeUser(viewer),
        services: services.map((entry) => this.summarizeService(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
        envGroups: envGroups.map((entry) => this.summarizeEnvGroup(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved Render token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.summarizeUser(viewer),
        services: services.map((entry) => this.summarizeService(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
        envGroups: envGroups.map((entry) => this.summarizeEnvGroup(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new RenderApiClient(loaded.token);

    try {
      const viewer = await client.getUser();
      const services = await client.listServices(20).catch(() => []);
      const projects = await client.listProjects(20).catch(() => []);
      const envGroups = await client.listEnvGroups(20).catch(() => []);
      const user = this.toSessionUser(viewer) ?? loaded.user;
      const status = this.activeStatus("Render API token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          user: this.summarizeUser(viewer),
          services: services.map((entry) => this.summarizeService(entry)),
          projects: projects.map((entry) => this.summarizeProject(entry)),
          envGroups: envGroups.map((entry) => this.summarizeEnvGroup(entry)),
        },
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Render token validation failed.";
      const status = this.expiredStatus(message, "RENDER_API_ERROR");
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
      message: "Loaded Render account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.summarizeUser(active.viewer),
        services: active.services.map((entry) => this.summarizeService(entry)),
        projects: active.projects.map((entry) => this.summarizeProject(entry)),
        envGroups: active.envGroups.map((entry) => this.summarizeEnvGroup(entry)),
      },
    });
  }

  async services(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.services.slice(0, input.limit ?? 20).map((entry) => this.summarizeService(entry));
    return this.buildActionResult({
      account: active.account,
      action: "services",
      message: `Loaded ${items.length} Render service${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: { services: items },
    });
  }

  async projects(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.projects.slice(0, input.limit ?? 20).map((entry) => this.summarizeProject(entry));
    return this.buildActionResult({
      account: active.account,
      action: "projects",
      message: `Loaded ${items.length} Render project${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: { projects: items },
    });
  }

  async envGroups(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.envGroups.slice(0, input.limit ?? 20).map((entry) => this.summarizeEnvGroup(entry));
    return this.buildActionResult({
      account: active.account,
      action: "env-groups",
      message: `Loaded ${items.length} Render environment group${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: { envGroups: items },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveRenderConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new RenderApiClient(loaded.token);
    const viewer = await client.getUser();
    const services = await client.listServices(20).catch(() => []);
    const projects = await client.listProjects(20).catch(() => []);
    const envGroups = await client.listEnvGroups(20).catch(() => []);
    const user = this.toSessionUser(viewer) ?? loaded.user;
    const status = this.activeStatus("Render API token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        services: services.map((entry) => this.summarizeService(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
        envGroups: envGroups.map((entry) => this.summarizeEnvGroup(entry)),
      },
    });

    return {
      ...loaded,
      path,
      user,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        services: services.map((entry) => this.summarizeService(entry)),
        projects: projects.map((entry) => this.summarizeProject(entry)),
        envGroups: envGroups.map((entry) => this.summarizeEnvGroup(entry)),
      },
      client,
      viewer,
      services,
      projects,
      envGroups,
    };
  }

  private toSessionUser(viewer: RenderUser): SessionUser | undefined {
    const username = viewer.email?.split("@")[0];
    const displayName = viewer.name ?? viewer.email ?? username;
    if (!displayName && !username) {
      return undefined;
    }

    return {
      id: viewer.id,
      username,
      displayName,
    };
  }

  private summarizeUser(viewer: RenderUser): Record<string, unknown> {
    return {
      id: viewer.id,
      username: viewer.email?.split("@")[0],
      displayName: viewer.name ?? viewer.email,
      email: viewer.email,
    };
  }

  private summarizeService(service: RenderService): Record<string, unknown> {
    return {
      id: service.id,
      name: service.name ?? service.slug,
      slug: service.slug,
      type: service.type,
      status: service.suspended ? "suspended" : service.serviceDetails?.env ?? "active",
      plan: service.serviceDetails?.plan,
      url: service.serviceDetails?.url,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private summarizeProject(project: RenderProject): Record<string, unknown> {
    return {
      id: project.id,
      name: project.name ?? project.slug,
      slug: project.slug,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private summarizeEnvGroup(group: RenderEnvGroup): Record<string, unknown> {
    return {
      id: group.id,
      name: group.name,
      environment: typeof group.envVarCount === "number" ? `${group.envVarCount} vars` : undefined,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}

export const renderAdapter = new RenderAdapter();

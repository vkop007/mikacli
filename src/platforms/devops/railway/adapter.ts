import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { RailwayApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { RailwayProject, RailwayService, RailwayUser } from "./client.js";

type ActiveRailwayConnection = LoadedApiKeyConnection & {
  client: RailwayApiClient;
  viewer: RailwayUser;
  projects: RailwayProject[];
};

export class RailwayAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "railway" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new RailwayApiClient(token);
    const viewer = await client.getViewer();
    const projects = await client.listProjects(20).catch(() => []);
    const user = this.toSessionUser(viewer);
    const account = this.resolveAccountName(input.account, [user?.username, viewer.email?.split("@")[0], viewer.id]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "railway",
      user,
      status: this.activeStatus("Railway token validated."),
      metadata: {
        user: this.summarizeUser(viewer),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved Railway token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.summarizeUser(viewer),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new RailwayApiClient(loaded.token);

    try {
      const viewer = await client.getViewer();
      const projects = await client.listProjects(20).catch(() => []);
      const user = this.toSessionUser(viewer) ?? loaded.user;
      const status = this.activeStatus("Railway token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          user: this.summarizeUser(viewer),
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
      const message = error instanceof Error ? error.message : "Railway token validation failed.";
      const status = this.expiredStatus(message, "RAILWAY_API_ERROR");
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
      message: "Loaded Railway account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.summarizeUser(active.viewer),
        projects: active.projects.map((entry) => this.summarizeProject(entry)),
      },
    });
  }

  async projects(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.projects.slice(0, input.limit ?? 20).map((entry) => this.summarizeProject(entry));
    return this.buildActionResult({
      account: active.account,
      action: "projects",
      message: `Loaded ${items.length} Railway project${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: { projects: items },
    });
  }

  async project(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const project = await active.client.getProject(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "project",
      message: `Loaded Railway project ${project.name ?? input.id}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        projects: [this.summarizeProject(project)],
      },
    });
  }

  async service(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const service = await active.client.getService(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "service",
      message: `Loaded Railway service ${service.name ?? input.id}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        services: [this.summarizeService(service)],
      },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveRailwayConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new RailwayApiClient(loaded.token);
    const viewer = await client.getViewer();
    const projects = await client.listProjects(20).catch(() => []);
    const user = this.toSessionUser(viewer) ?? loaded.user;
    const status = this.activeStatus("Railway token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
    });

    return {
      ...loaded,
      path,
      user,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
      client,
      viewer,
      projects,
    };
  }

  private toSessionUser(viewer: RailwayUser): SessionUser | undefined {
    const username = viewer.username ?? viewer.email?.split("@")[0];
    const displayName = viewer.name ?? viewer.email ?? username;
    if (!displayName && !username) {
      return undefined;
    }

    return {
      id: viewer.id,
      username,
      displayName,
      profileUrl: viewer.username ? `https://railway.com/u/${viewer.username}` : undefined,
    };
  }

  private summarizeUser(viewer: RailwayUser): Record<string, unknown> {
    return {
      id: viewer.id,
      username: viewer.username ?? viewer.email?.split("@")[0],
      displayName: viewer.name ?? viewer.email,
      email: viewer.email,
      createdAt: viewer.createdAt,
    };
  }

  private summarizeProject(project: RailwayProject): Record<string, unknown> {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      teamName: project.teamId,
      status: project.isTempProject ? "temporary" : project.isPublic ? "public" : "private",
    };
  }

  private summarizeService(service: RailwayService): Record<string, unknown> {
    return {
      id: service.id,
      name: service.name,
      projectRef: service.projectId,
      type: service.icon,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}

export const railwayAdapter = new RailwayAdapter();

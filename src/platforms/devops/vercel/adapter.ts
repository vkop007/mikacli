import { MikaCliError } from "../../../errors.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { VercelApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { VercelDeployment, VercelProject, VercelTeam, VercelUser } from "./client.js";

type ActiveVercelConnection = LoadedApiKeyConnection & {
  client: VercelApiClient;
  viewer: VercelUser;
  teams: VercelTeam[];
};

export class VercelAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "vercel" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new VercelApiClient(token);
    const viewer = await client.getUser();
    const teams = await client.listTeams(20).catch(() => []);
    const user = this.toSessionUser(viewer);
    const account = this.resolveAccountName(input.account, [user?.username, viewer.email?.split("@")[0], viewer.id]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "vercel",
      user,
      status: this.activeStatus("Vercel API token validated."),
      metadata: {
        user: this.summarizeUser(viewer),
        teams: teams.map((entry) => this.summarizeTeam(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved Vercel token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.summarizeUser(viewer),
        teams: teams.map((entry) => this.summarizeTeam(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new VercelApiClient(loaded.token);

    try {
      const viewer = await client.getUser();
      const teams = await client.listTeams(20).catch(() => []);
      const user = this.toSessionUser(viewer);
      const status = this.activeStatus("Vercel API token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          user: this.summarizeUser(viewer),
          teams: teams.map((entry) => this.summarizeTeam(entry)),
        },
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vercel token validation failed.";
      const status = this.expiredStatus(message, "VERCEL_API_ERROR");
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
      message: "Loaded Vercel account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.summarizeUser(active.viewer),
        teams: active.teams.map((entry) => this.summarizeTeam(entry)),
      },
    });
  }

  async teams(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.teams.slice(0, input.limit ?? 20).map((entry) => this.summarizeTeam(entry));
    return this.buildActionResult({
      account: active.account,
      action: "teams",
      message: `Loaded ${items.length} Vercel team${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        teams: items,
      },
    });
  }

  async projects(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const projects = await active.client.listProjects(input.limit ?? 20);
    return this.buildActionResult({
      account: active.account,
      action: "projects",
      message: `Loaded ${projects.length} Vercel project${projects.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        projects: projects.map((entry) => this.summarizeProject(entry)),
      },
    });
  }

  async deployments(input: { account?: string; limit?: number; project?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const project = input.project ? await this.resolveProject(active.client, input.project) : undefined;
    const deployments = await active.client.listDeployments(input.limit ?? 20, project?.id);
    return this.buildActionResult({
      account: active.account,
      action: "deployments",
      message: `Loaded ${deployments.length} Vercel deployment${deployments.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        project: project ? this.summarizeProject(project) : undefined,
        deployments: deployments.map((entry) => this.summarizeDeployment(entry, project)),
      },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveVercelConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new VercelApiClient(loaded.token);
    const viewer = await client.getUser();
    const teams = await client.listTeams(20).catch(() => []);
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus("Vercel API token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        teams: teams.map((entry) => this.summarizeTeam(entry)),
      },
    });

    return {
      ...loaded,
      path,
      user,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        teams: teams.map((entry) => this.summarizeTeam(entry)),
      },
      client,
      viewer,
      teams,
    };
  }

  private async resolveProject(client: VercelApiClient, target: string): Promise<VercelProject> {
    const normalized = target.trim();
    if (!normalized) {
      throw new MikaCliError("VERCEL_PROJECT_REQUIRED", "Vercel deployments --project requires a project name or project ID.");
    }

    const projects = await client.listProjects(100);
    const match = projects.find((entry) => entry.id === normalized || entry.name.toLowerCase() === normalized.toLowerCase());
    if (!match) {
      throw new MikaCliError("VERCEL_PROJECT_NOT_FOUND", `No Vercel project matched "${target}".`);
    }

    return match;
  }

  private toSessionUser(viewer: VercelUser): SessionUser | undefined {
    return {
      id: viewer.id,
      username: viewer.username ?? viewer.email?.split("@")[0],
      displayName: viewer.name ?? viewer.username ?? viewer.email,
    };
  }

  private summarizeUser(viewer: VercelUser): Record<string, unknown> {
    return {
      id: viewer.id,
      username: viewer.username,
      displayName: viewer.name ?? viewer.username ?? viewer.email,
      email: viewer.email,
    };
  }

  private summarizeTeam(team: VercelTeam): Record<string, unknown> {
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      url: team.slug ? `https://vercel.com/${team.slug}` : undefined,
    };
  }

  private summarizeProject(project: VercelProject): Record<string, unknown> {
    return {
      id: project.id,
      name: project.name,
      framework: project.framework,
      createdAt: formatEpoch(project.createdAt),
      updatedAt: formatEpoch(project.updatedAt),
      url: `https://vercel.com/${project.name}`,
    };
  }

  private summarizeDeployment(deployment: VercelDeployment, project?: VercelProject): Record<string, unknown> {
    return {
      id: deployment.uid,
      name: deployment.name ?? project?.name ?? deployment.url,
      status: deployment.state,
      environment: deployment.target,
      projectName: project?.name,
      createdAt: formatEpoch(deployment.createdAt),
      url: deployment.url ? `https://${deployment.url}` : undefined,
    };
  }
}

export const vercelAdapter = new VercelAdapter();

function formatEpoch(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
}

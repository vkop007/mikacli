import { MikaCliError } from "../../../errors.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { DigitalOceanApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { DigitalOceanAccount, DigitalOceanApp, DigitalOceanDeployment, DigitalOceanDomain } from "./client.js";

type ActiveDigitalOceanConnection = LoadedApiKeyConnection & {
  client: DigitalOceanApiClient;
  viewer: DigitalOceanAccount;
  apps: DigitalOceanApp[];
};

export class DigitalOceanAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "digitalocean" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new DigitalOceanApiClient(token);
    const viewer = await client.getAccount();
    const apps = await client.listApps(20).catch(() => []);
    const user = this.toSessionUser(viewer);
    const account = this.resolveAccountName(input.account, [user?.username, viewer.email?.split("@")[0], viewer.uuid]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "digitalocean",
      user,
      status: this.activeStatus("DigitalOcean API token validated."),
      metadata: {
        user: this.summarizeUser(viewer),
        apps: apps.map((entry) => this.summarizeApp(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved DigitalOcean token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.summarizeUser(viewer),
        apps: apps.map((entry) => this.summarizeApp(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new DigitalOceanApiClient(loaded.token);

    try {
      const viewer = await client.getAccount();
      const apps = await client.listApps(20).catch(() => []);
      const user = this.toSessionUser(viewer) ?? loaded.user;
      const status = this.activeStatus("DigitalOcean API token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          user: this.summarizeUser(viewer),
          apps: apps.map((entry) => this.summarizeApp(entry)),
        },
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "DigitalOcean token validation failed.";
      const status = this.expiredStatus(message, "DIGITALOCEAN_API_ERROR");
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
      message: "Loaded DigitalOcean account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.summarizeUser(active.viewer),
        apps: active.apps.map((entry) => this.summarizeApp(entry)),
      },
    });
  }

  async apps(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.apps.slice(0, input.limit ?? 20).map((entry) => this.summarizeApp(entry));
    return this.buildActionResult({
      account: active.account,
      action: "apps",
      message: `Loaded ${items.length} DigitalOcean app${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: { apps: items },
    });
  }

  async deployments(input: { account?: string; app: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const app = this.resolveApp(active.apps, input.app);
    if (!app.id) {
      throw new MikaCliError("DIGITALOCEAN_APP_ID_MISSING", `DigitalOcean app "${app.spec?.name ?? input.app}" does not include an ID.`);
    }

    const deployments = await active.client.listDeployments(app.id, input.limit ?? 20);
    return this.buildActionResult({
      account: active.account,
      action: "deployments",
      message: `Loaded ${deployments.length} DigitalOcean deployment${deployments.length === 1 ? "" : "s"} for ${app.spec?.name ?? app.id}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        app: this.summarizeApp(app),
        deployments: deployments.map((entry) => this.summarizeDeployment(entry, app)),
      },
    });
  }

  async domains(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const domains = await active.client.listDomains(input.limit ?? 20);
    return this.buildActionResult({
      account: active.account,
      action: "domains",
      message: `Loaded ${domains.length} DigitalOcean domain${domains.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        domains: domains.map((entry) => this.summarizeDomain(entry)),
      },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveDigitalOceanConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new DigitalOceanApiClient(loaded.token);
    const viewer = await client.getAccount();
    const apps = await client.listApps(20).catch(() => []);
    const user = this.toSessionUser(viewer) ?? loaded.user;
    const status = this.activeStatus("DigitalOcean API token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        apps: apps.map((entry) => this.summarizeApp(entry)),
      },
    });

    return {
      ...loaded,
      path,
      user,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        apps: apps.map((entry) => this.summarizeApp(entry)),
      },
      client,
      viewer,
      apps,
    };
  }

  private resolveApp(apps: DigitalOceanApp[], target: string): DigitalOceanApp {
    const normalized = target.trim().toLowerCase();
    const match = apps.find((app) =>
      app.id === target ||
      app.spec?.name?.toLowerCase() === normalized,
    );

    if (!match) {
      throw new MikaCliError("DIGITALOCEAN_APP_NOT_FOUND", `No DigitalOcean app matched "${target}".`);
    }

    return match;
  }

  private toSessionUser(viewer: DigitalOceanAccount): SessionUser | undefined {
    const username = viewer.email?.split("@")[0];
    const displayName = viewer.email ?? username;
    if (!displayName && !username) {
      return undefined;
    }

    return {
      id: viewer.uuid,
      username,
      displayName,
    };
  }

  private summarizeUser(viewer: DigitalOceanAccount): Record<string, unknown> {
    return {
      id: viewer.uuid,
      username: viewer.email?.split("@")[0],
      displayName: viewer.email,
      email: viewer.email,
      status: viewer.status,
      emailVerified: viewer.email_verified,
    };
  }

  private summarizeApp(app: DigitalOceanApp): Record<string, unknown> {
    return {
      id: app.id,
      name: app.spec?.name ?? app.id,
      region: app.region?.slug,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      url: app.default_ingress,
    };
  }

  private summarizeDeployment(deployment: DigitalOceanDeployment, app: DigitalOceanApp): Record<string, unknown> {
    return {
      id: deployment.id,
      name: app.spec?.name ?? deployment.id,
      status: deployment.phase,
      type: deployment.cause,
      createdAt: deployment.created_at,
      updatedAt: deployment.updated_at,
    };
  }

  private summarizeDomain(domain: DigitalOceanDomain): Record<string, unknown> {
    return {
      id: domain.name,
      name: domain.name,
      ttl: domain.ttl,
    };
  }
}

export const digitalOceanAdapter = new DigitalOceanAdapter();

import { MikaCliError } from "../../../errors.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { NetlifyApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { NetlifyAccount, NetlifyDeploy, NetlifyDnsZone, NetlifySite, NetlifyUser } from "./client.js";

type ActiveNetlifyConnection = LoadedApiKeyConnection & {
  client: NetlifyApiClient;
  viewer: NetlifyUser;
  accounts: NetlifyAccount[];
  sites: NetlifySite[];
};

export class NetlifyAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "netlify" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new NetlifyApiClient(token);
    const viewer = await client.getUser();
    const accounts = await client.listAccounts(20).catch(() => []);
    const sites = await client.listSites(20).catch(() => []);
    const user = this.toSessionUser(viewer);
    const account = this.resolveAccountName(input.account, [user?.username, viewer.email?.split("@")[0], viewer.id]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "netlify",
      user,
      status: this.activeStatus("Netlify API token validated."),
      metadata: {
        user: this.summarizeUser(viewer),
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
        sites: sites.map((entry) => this.summarizeSite(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved Netlify token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.summarizeUser(viewer),
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
        sites: sites.map((entry) => this.summarizeSite(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new NetlifyApiClient(loaded.token);

    try {
      const viewer = await client.getUser();
      const accounts = await client.listAccounts(20).catch(() => []);
      const sites = await client.listSites(20).catch(() => []);
      const user = this.toSessionUser(viewer) ?? loaded.user;
      const status = this.activeStatus("Netlify API token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          user: this.summarizeUser(viewer),
          accounts: accounts.map((entry) => this.summarizeAccount(entry)),
          sites: sites.map((entry) => this.summarizeSite(entry)),
        },
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Netlify token validation failed.";
      const status = this.expiredStatus(message, "NETLIFY_API_ERROR");
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
      message: "Loaded Netlify account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.summarizeUser(active.viewer),
        accounts: active.accounts.map((entry) => this.summarizeAccount(entry)),
        sites: active.sites.map((entry) => this.summarizeSite(entry)),
      },
    });
  }

  async accounts(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.accounts.slice(0, input.limit ?? 20).map((entry) => this.summarizeAccount(entry));
    return this.buildActionResult({
      account: active.account,
      action: "accounts",
      message: `Loaded ${items.length} Netlify account${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: { accounts: items },
    });
  }

  async sites(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.sites.slice(0, input.limit ?? 20).map((entry) => this.summarizeSite(entry));
    return this.buildActionResult({
      account: active.account,
      action: "sites",
      message: `Loaded ${items.length} Netlify site${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: { sites: items },
    });
  }

  async deploys(input: { account?: string; limit?: number; site?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const site = input.site ? this.resolveSite(active.sites, input.site) : active.sites[0];
    if (!site?.id) {
      throw new MikaCliError("NETLIFY_SITE_REQUIRED", "Netlify deploys requires --site when the token does not expose a default site.");
    }

    const deploys = await active.client.listDeploys(site.id, input.limit ?? 20);
    return this.buildActionResult({
      account: active.account,
      action: "deploys",
      message: `Loaded ${deploys.length} Netlify deploy${deploys.length === 1 ? "" : "s"} for ${site.name ?? site.id}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        site: this.summarizeSite(site),
        deployments: deploys.map((entry) => this.summarizeDeploy(entry, site)),
      },
    });
  }

  async dns(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const zones = await active.client.listDnsZones(input.limit ?? 20);
    return this.buildActionResult({
      account: active.account,
      action: "dns",
      message: `Loaded ${zones.length} Netlify DNS zone${zones.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        zones: zones.map((entry) => this.summarizeZone(entry)),
      },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveNetlifyConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new NetlifyApiClient(loaded.token);
    const viewer = await client.getUser();
    const accounts = await client.listAccounts(20).catch(() => []);
    const sites = await client.listSites(20).catch(() => []);
    const user = this.toSessionUser(viewer) ?? loaded.user;
    const status = this.activeStatus("Netlify API token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
        sites: sites.map((entry) => this.summarizeSite(entry)),
      },
    });

    return {
      ...loaded,
      path,
      user,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
        sites: sites.map((entry) => this.summarizeSite(entry)),
      },
      client,
      viewer,
      accounts,
      sites,
    };
  }

  private resolveSite(sites: NetlifySite[], target: string): NetlifySite {
    const normalized = target.trim().toLowerCase();
    const match = sites.find((site) =>
      site.id === target ||
      site.name?.toLowerCase() === normalized ||
      site.url?.toLowerCase() === normalized ||
      site.ssl_url?.toLowerCase() === normalized ||
      site.admin_url?.toLowerCase() === normalized,
    );

    if (!match) {
      throw new MikaCliError("NETLIFY_SITE_NOT_FOUND", `No Netlify site matched "${target}".`);
    }

    return match;
  }

  private toSessionUser(viewer: NetlifyUser): SessionUser | undefined {
    const username = viewer.email?.split("@")[0];
    const displayName = viewer.full_name ?? viewer.email ?? username;
    if (!displayName && !username) {
      return undefined;
    }

    return {
      id: viewer.id,
      username,
      displayName,
    };
  }

  private summarizeUser(viewer: NetlifyUser): Record<string, unknown> {
    return {
      id: viewer.id,
      username: viewer.email?.split("@")[0],
      displayName: viewer.full_name ?? viewer.email,
      email: viewer.email,
    };
  }

  private summarizeAccount(account: NetlifyAccount): Record<string, unknown> {
    return {
      id: account.id,
      name: account.name ?? account.slug,
      slug: account.slug,
      type: account.type_name,
    };
  }

  private summarizeSite(site: NetlifySite): Record<string, unknown> {
    return {
      id: site.id,
      name: site.name,
      accountName: site.account_name,
      createdAt: site.created_at,
      updatedAt: site.updated_at,
      url: site.ssl_url ?? site.url ?? site.admin_url,
    };
  }

  private summarizeDeploy(deploy: NetlifyDeploy, site: NetlifySite): Record<string, unknown> {
    return {
      id: deploy.id,
      name: deploy.name ?? site.name ?? deploy.id,
      status: deploy.state,
      environment: deploy.context,
      createdAt: deploy.created_at,
      updatedAt: deploy.updated_at,
      url: deploy.deploy_url ?? deploy.url,
    };
  }

  private summarizeZone(zone: NetlifyDnsZone): Record<string, unknown> {
    return {
      id: zone.id,
      name: zone.name,
      accountName: zone.account_id,
      createdAt: zone.created_at,
      updatedAt: zone.updated_at,
    };
  }
}

export const netlifyAdapter = new NetlifyAdapter();

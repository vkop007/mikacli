import { MikaCliError } from "../../../errors.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { CloudflareApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { CloudflareAccount, CloudflareDnsRecord, CloudflareTokenVerification, CloudflareZone } from "./client.js";

type ActiveCloudflareConnection = LoadedApiKeyConnection & {
  client: CloudflareApiClient;
  verification: CloudflareTokenVerification;
  accounts: CloudflareAccount[];
};

export class CloudflareAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "cloudflare" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new CloudflareApiClient(token);
    const verification = await client.verifyToken();
    const accounts = await client.listAccounts(20).catch(() => []);
    const user = this.toSessionUser(verification, accounts);
    const account = this.resolveAccountName(input.account, [user?.username, accounts[0]?.name, verification.id]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "cloudflare",
      user,
      status: this.activeStatus("Cloudflare API token validated."),
      metadata: {
        tokenId: verification.id,
        tokenStatus: verification.status,
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved Cloudflare token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.buildUserPayload(user),
        token: verification,
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new CloudflareApiClient(loaded.token);

    try {
      const verification = await client.verifyToken();
      const accounts = await client.listAccounts(20).catch(() => []);
      const user = this.toSessionUser(verification, accounts) ?? loaded.user;
      const status = this.activeStatus("Cloudflare API token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          tokenId: verification.id,
          tokenStatus: verification.status,
          accounts: accounts.map((entry) => this.summarizeAccount(entry)),
        },
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloudflare token validation failed.";
      const status = this.expiredStatus(message, "CLOUDFLARE_API_ERROR");
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
      message: "Loaded Cloudflare token summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.buildUserPayload(active.user),
        token: active.verification,
        accounts: active.accounts.map((entry) => this.summarizeAccount(entry)),
      },
    });
  }

  async accounts(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = active.accounts.slice(0, input.limit ?? 20).map((entry) => this.summarizeAccount(entry));
    return this.buildActionResult({
      account: active.account,
      action: "accounts",
      message: `Loaded ${items.length} Cloudflare account${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        accounts: items,
      },
    });
  }

  async zones(input: { account?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const zones = await active.client.listZones(input.limit ?? 20);
    return this.buildActionResult({
      account: active.account,
      action: "zones",
      message: `Loaded ${zones.length} Cloudflare zone${zones.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        zones: zones.map((entry) => this.summarizeZone(entry)),
      },
    });
  }

  async dns(input: { account?: string; zone: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const zone = await this.resolveZone(active.client, input.zone);
    const records = await active.client.listDnsRecords(zone.id, input.limit ?? 20);
    return this.buildActionResult({
      account: active.account,
      action: "dns",
      message: `Loaded ${records.length} DNS record${records.length === 1 ? "" : "s"} for ${zone.name}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        zone: this.summarizeZone(zone),
        records: records.map((entry) => this.summarizeRecord(entry, zone)),
      },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveCloudflareConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new CloudflareApiClient(loaded.token);
    const verification = await client.verifyToken();
    const accounts = await client.listAccounts(20).catch(() => []);
    const user = this.toSessionUser(verification, accounts) ?? loaded.user;
    const status = this.activeStatus("Cloudflare API token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        tokenId: verification.id,
        tokenStatus: verification.status,
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
      },
    });

    return {
      ...loaded,
      path,
      user,
      metadata: {
        ...(loaded.metadata ?? {}),
        tokenId: verification.id,
        tokenStatus: verification.status,
        accounts: accounts.map((entry) => this.summarizeAccount(entry)),
      },
      client,
      verification,
      accounts,
    };
  }

  private async resolveZone(client: CloudflareApiClient, target: string): Promise<CloudflareZone> {
    const normalized = target.trim();
    if (!normalized) {
      throw new MikaCliError("CLOUDFLARE_ZONE_REQUIRED", "Cloudflare DNS commands require a zone name or zone ID.");
    }

    const zones = await client.listZones(100);
    const match = zones.find((entry) => entry.id === normalized || entry.name.toLowerCase() === normalized.toLowerCase());
    if (!match) {
      throw new MikaCliError("CLOUDFLARE_ZONE_NOT_FOUND", `No Cloudflare zone matched "${target}".`);
    }

    return match;
  }

  private toSessionUser(verification: CloudflareTokenVerification, accounts: CloudflareAccount[]): SessionUser | undefined {
    const firstAccount = accounts[0];
    const displayName = firstAccount?.name ?? "Cloudflare Token";
    return {
      id: verification.id,
      username: firstAccount?.name ? firstAccount.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined,
      displayName,
    };
  }

  private buildUserPayload(user: SessionUser | undefined): Record<string, unknown> | undefined {
    if (!user) {
      return undefined;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };
  }

  private summarizeAccount(account: CloudflareAccount): Record<string, unknown> {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
    };
  }

  private summarizeZone(zone: CloudflareZone): Record<string, unknown> {
    return {
      id: zone.id,
      name: zone.name,
      status: zone.status,
      accountName: zone.account?.name,
      plan: zone.plan?.name,
      url: `https://dash.cloudflare.com/${zone.account?.id ?? "unknown"}/${zone.name}`,
    };
  }

  private summarizeRecord(record: CloudflareDnsRecord, zone: CloudflareZone): Record<string, unknown> {
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      content: record.content,
      status: record.proxied === true ? "proxied" : record.proxied === false ? "dns-only" : undefined,
      ttl: typeof record.ttl === "number" ? String(record.ttl) : undefined,
      projectName: zone.name,
      updatedAt: record.modified_on,
      url: `https://dash.cloudflare.com/${zone.account?.id ?? "unknown"}/${zone.name}/dns/records/${record.id}`,
    };
  }
}

export const cloudflareAdapter = new CloudflareAdapter();

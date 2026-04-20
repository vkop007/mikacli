import { MikaCliError } from "../../../errors.js";
import { type SessionStatus } from "../../../types.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { FlyApiClient } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";
import type { FlyApp, FlyCertificate, FlyMachine, FlyVolume } from "./client.js";

type ActiveFlyConnection = LoadedApiKeyConnection & {
  client: FlyApiClient;
  org: string;
  apps: FlyApp[];
};

export class FlyAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "fly" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new FlyApiClient(token);
    const org = "personal";
    let apps: FlyApp[] = [];
    let status: SessionStatus = this.activeStatus(`Fly Machines token validated for org "${org}".`);
    try {
      apps = await client.listApps(org);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fly token saved without validation.";
      status = {
        state: "unknown",
        message: `Saved Fly token, but org-aware validation failed for "${org}": ${message}`,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: "FLY_ORG_REQUIRED",
      };
    }

    const user = this.toSessionUser(org);
    const account = this.resolveAccountName(input.account, [user?.username, org]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "fly",
      user,
      status,
      metadata: {
        org,
        apps: apps.map((entry) => this.summarizeApp(entry)),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: status.state === "active" ? `Saved Fly token for ${account}.` : `Saved Fly token for ${account}; validate it later with an org-aware command like "apps --org <slug>".`,
      sessionPath,
      user,
      data: {
        user: this.summarizeUser(org),
        org,
        apps: apps.map((entry) => this.summarizeApp(entry)),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new FlyApiClient(loaded.token);
    const org = this.resolveOrg(loaded.metadata);

    try {
      const apps = await client.listApps(org);
      const user = this.toSessionUser(org) ?? loaded.user;
      const status = this.activeStatus(`Fly Machines token validated for org "${org}".`);
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          org,
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
      const message = error instanceof Error ? error.message : `Fly token validation failed for "${org}".`;
      const status: SessionStatus = {
        state: "unknown",
        message: `Fly token is saved, but validation failed for org "${org}": ${message}`,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: "FLY_ORG_REQUIRED",
      };
      const sessionPath = await this.persistTokenConnection(loaded, {
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          org,
        },
      });
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
    const active = await this.ensureConnection(account);
    return this.buildActionResult({
      account: active.account,
      action: "me",
      message: "Loaded Fly Machines workspace summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.summarizeUser(active.org),
        org: active.org,
        apps: active.apps.map((entry) => this.summarizeApp(entry)),
      },
    });
  }

  async apps(input: { account?: string; limit?: number; org?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureConnection(input.account);
    const org = input.org?.trim() || active.org;
    const apps = await active.client.listApps(org);
    const path = await this.persistTokenConnection(active, {
      user: this.toSessionUser(org),
      status: this.activeStatus(`Fly Machines token validated for org "${org}".`),
      metadata: {
        ...(active.metadata ?? {}),
        org,
        apps: apps.map((entry) => this.summarizeApp(entry)),
      },
    });

    return this.buildActionResult({
      account: active.account,
      action: "apps",
      message: `Loaded ${Math.min(apps.length, input.limit ?? 20)} Fly app${apps.length === 1 ? "" : "s"} for org "${org}".`,
      sessionPath: path,
      user: this.toSessionUser(org),
      data: {
        apps: apps.slice(0, input.limit ?? 20).map((entry) => this.summarizeApp(entry)),
      },
    });
  }

  async app(input: { account?: string; app: string }): Promise<AdapterActionResult> {
    const active = await this.ensureConnection(input.account);
    const app = await active.client.getApp(input.app);
    return this.buildActionResult({
      account: active.account,
      action: "app",
      message: `Loaded Fly app ${app.name ?? input.app}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        apps: [this.summarizeApp(app)],
      },
    });
  }

  async machines(input: { account?: string; app: string }): Promise<AdapterActionResult> {
    const active = await this.ensureConnection(input.account);
    const machines = await active.client.listMachines(input.app);
    return this.buildActionResult({
      account: active.account,
      action: "machines",
      message: `Loaded ${machines.length} Fly machine${machines.length === 1 ? "" : "s"} for ${input.app}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        machines: machines.map((entry) => this.summarizeMachine(entry)),
      },
    });
  }

  async volumes(input: { account?: string; app: string }): Promise<AdapterActionResult> {
    const active = await this.ensureConnection(input.account);
    const volumes = await active.client.listVolumes(input.app);
    return this.buildActionResult({
      account: active.account,
      action: "volumes",
      message: `Loaded ${volumes.length} Fly volume${volumes.length === 1 ? "" : "s"} for ${input.app}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        volumes: volumes.map((entry) => this.summarizeVolume(entry)),
      },
    });
  }

  async certificates(input: { account?: string; app: string }): Promise<AdapterActionResult> {
    const active = await this.ensureConnection(input.account);
    const certificates = await active.client.listCertificates(input.app);
    return this.buildActionResult({
      account: active.account,
      action: "certificates",
      message: `Loaded ${certificates.length} Fly certificate${certificates.length === 1 ? "" : "s"} for ${input.app}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        certificates: certificates.map((entry) => this.summarizeCertificate(entry)),
      },
    });
  }

  private async ensureConnection(account?: string): Promise<ActiveFlyConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new FlyApiClient(loaded.token);
    const org = this.resolveOrg(loaded.metadata);
    let apps: FlyApp[] = [];
    try {
      apps = await client.listApps(org);
    } catch {
      apps = [];
    }

    return {
      ...loaded,
      user: this.toSessionUser(org) ?? loaded.user,
      client,
      org,
      apps,
    };
  }

  private resolveOrg(metadata: Record<string, unknown> | undefined): string {
    const org = metadata?.org;
    return typeof org === "string" && org.trim().length > 0 ? org.trim() : "personal";
  }

  private toSessionUser(org: string): SessionUser | undefined {
    return {
      id: org,
      username: org,
      displayName: `Fly org ${org}`,
    };
  }

  private summarizeUser(org: string): Record<string, unknown> {
    return {
      id: org,
      username: org,
      displayName: `Fly org ${org}`,
    };
  }

  private summarizeApp(app: FlyApp): Record<string, unknown> {
    return {
      id: app.id,
      name: app.name,
      status: app.status,
      organizationName: app.organization?.name ?? app.organization?.slug,
      url: app.hostname ? `https://${app.hostname}` : undefined,
    };
  }

  private summarizeMachine(machine: FlyMachine): Record<string, unknown> {
    return {
      id: machine.id,
      name: machine.name ?? machine.id,
      status: machine.state,
      region: machine.region,
      type: machine.image_ref?.repository,
      createdAt: machine.created_at,
      updatedAt: machine.updated_at,
    };
  }

  private summarizeVolume(volume: FlyVolume): Record<string, unknown> {
    return {
      id: volume.id,
      name: volume.name ?? volume.id,
      status: volume.state,
      region: volume.region,
      type: typeof volume.size_gb === "number" ? `${volume.size_gb} GB` : undefined,
      createdAt: volume.created_at,
    };
  }

  private summarizeCertificate(certificate: FlyCertificate): Record<string, unknown> {
    return {
      id: certificate.hostname,
      name: certificate.hostname,
      status: certificate.configured ? "configured" : "pending",
      type: certificate.certificate_authority ?? certificate.source,
      createdAt: certificate.created_at,
    };
  }
}

export const flyAdapter = new FlyAdapter();

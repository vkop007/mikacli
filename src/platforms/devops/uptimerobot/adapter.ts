import { AutoCliError } from "../../../errors.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { UptimeRobotApiClient, type UptimeRobotIncident, type UptimeRobotIntegration, type UptimeRobotMonitor, type UptimeRobotPagination, type UptimeRobotUser } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, SessionUser } from "../../../types.js";

type ActiveUptimeRobotConnection = LoadedApiKeyConnection & {
  client: UptimeRobotApiClient;
  viewer: UptimeRobotUser;
};

type MonitorsInput = {
  account?: string;
  limit?: number;
  groupId?: number;
  status?: string;
  name?: string;
  url?: string;
  tags?: string;
  cursor?: number;
};

type UptimeStatsInput = {
  account?: string;
  timeFrame: string;
  start?: number;
  end?: number;
  logLimit?: number;
};

type MonitorStatsInput = {
  account?: string;
  id: number;
  from?: string;
  to?: string;
};

type MonitorResponseTimesInput = MonitorStatsInput & {
  includeTimeSeries?: boolean;
};

type IncidentsInput = {
  account?: string;
  cursor?: string;
  monitorId?: number;
  monitorName?: string;
  startedAfter?: string;
  startedBefore?: string;
};

type IntegrationsInput = {
  account?: string;
  cursor?: number;
};

export class UptimeRobotAdapter extends BaseApiKeyPlatformAdapter {
  readonly platform = "uptimerobot" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const token = this.requireToken(input.token);
    const client = new UptimeRobotApiClient(token);
    const viewer = await client.getMe();
    const previewMonitors = await client.listMonitors({ limit: 3 }).catch(() => ({ data: [], nextLink: null }));
    const user = this.toSessionUser(viewer);
    const account = this.resolveAccountName(input.account, [user?.username, viewer.email, viewer.fullName]);
    const sessionPath = await this.saveTokenConnection({
      account,
      token,
      provider: "uptimerobot",
      user,
      status: this.activeStatus("UptimeRobot API token validated."),
      metadata: {
        user: this.summarizeUser(viewer),
        previewMonitors: toRecordArray(previewMonitors.data),
      },
    });

    return this.buildActionResult({
      account,
      action: "login",
      message: `Saved UptimeRobot token for ${account}.`,
      sessionPath,
      user,
      data: {
        user: this.summarizeUser(viewer),
        monitors: toRecordArray(previewMonitors.data),
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadTokenConnection(account);
    const client = new UptimeRobotApiClient(loaded.token);

    try {
      const viewer = await client.getMe();
      const user = this.toSessionUser(viewer) ?? loaded.user;
      const status = this.activeStatus("UptimeRobot API token validated.");
      const sessionPath = await this.persistTokenConnection(loaded, {
        user,
        status,
        metadata: {
          ...(loaded.metadata ?? {}),
          user: this.summarizeUser(viewer),
        },
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath,
        status,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "UptimeRobot token validation failed.";
      const status = this.expiredStatus(message, "UPTIMEROBOT_API_ERROR");
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
      message: "Loaded UptimeRobot account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        user: this.summarizeUser(active.viewer),
      },
    });
  }

  async monitors(input: MonitorsInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listMonitors({
      limit: input.limit,
      groupId: input.groupId,
      status: input.status,
      name: input.name,
      url: input.url,
      tags: input.tags,
      cursor: input.cursor,
    });
    return this.buildActionResult({
      account: active.account,
      action: "monitors",
      message: `Loaded ${payload.data.length} UptimeRobot monitor${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        monitors: toRecordArray(payload.data),
        nextLink: payload.nextLink ?? null,
      },
    });
  }

  async monitor(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.getMonitor(input.id);
    const record = toRecord(monitor);

    return this.buildActionResult({
      account: active.account,
      action: "monitor",
      message: `Loaded monitor ${describeMonitor(record)}.`,
      sessionPath: active.path,
      user: active.user,
      id: toStringValue(record.id),
      url: toStringValue(record.url),
      data: {
        monitor: record,
      },
    });
  }

  async uptimeStats(input: UptimeStatsInput): Promise<AdapterActionResult> {
    if (input.timeFrame === "CUSTOM" && (typeof input.start !== "number" || typeof input.end !== "number")) {
      throw new AutoCliError("UPTIMEROBOT_CUSTOM_TIMEFRAME_REQUIRED", "CUSTOM uptime stats require both --start and --end Unix timestamps.");
    }

    const active = await this.ensureActiveConnection(input.account);
    const stats = await active.client.getUptimeStats({
      timeFrame: input.timeFrame,
      start: input.start,
      end: input.end,
      logLimit: input.logLimit,
    });

    return this.buildActionResult({
      account: active.account,
      action: "uptime-stats",
      message: "Loaded aggregated UptimeRobot uptime stats.",
      sessionPath: active.path,
      user: active.user,
      data: {
        uptimeStats: toRecord(stats),
      },
    });
  }

  async monitorStats(input: MonitorStatsInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const stats = await active.client.getMonitorUptimeStats(input.id, {
      from: input.from,
      to: input.to,
    });

    return this.buildActionResult({
      account: active.account,
      action: "monitor-stats",
      message: `Loaded uptime stats for monitor ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        monitorStats: toRecord(stats),
        monitorId: input.id,
      },
    });
  }

  async responseTimes(input: MonitorResponseTimesInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const stats = await active.client.getMonitorResponseTimeStats(input.id, {
      from: input.from,
      to: input.to,
      includeTimeSeries: input.includeTimeSeries,
    });

    return this.buildActionResult({
      account: active.account,
      action: "response-times",
      message: `Loaded response time stats for monitor ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        responseTimes: toRecord(stats),
        monitorId: input.id,
      },
    });
  }

  async pause(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.pauseMonitor(input.id);
    const record = toRecord(monitor);

    return this.buildActionResult({
      account: active.account,
      action: "pause",
      message: `Paused monitor ${describeMonitor(record)}.`,
      sessionPath: active.path,
      user: active.user,
      id: toStringValue(record.id) ?? String(input.id),
      url: toStringValue(record.url),
      data: {
        monitor: record,
      },
    });
  }

  async start(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.startMonitor(input.id);
    const record = toRecord(monitor);

    return this.buildActionResult({
      account: active.account,
      action: "start",
      message: `Started monitor ${describeMonitor(record)}.`,
      sessionPath: active.path,
      user: active.user,
      id: toStringValue(record.id) ?? String(input.id),
      url: toStringValue(record.url),
      data: {
        monitor: record,
      },
    });
  }

  async createMonitor(input: { account?: string; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.createMonitor(input.body);
    const record = toRecord(monitor);

    return this.buildActionResult({
      account: active.account,
      action: "create-monitor",
      message: `Created monitor ${describeMonitor(record)}.`,
      sessionPath: active.path,
      user: active.user,
      id: toStringValue(record.id),
      url: toStringValue(record.url),
      data: {
        monitor: record,
      },
    });
  }

  async updateMonitor(input: { account?: string; id: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.updateMonitor(input.id, input.body);
    const record = toRecord(monitor);

    return this.buildActionResult({
      account: active.account,
      action: "update-monitor",
      message: `Updated monitor ${describeMonitor(record)}.`,
      sessionPath: active.path,
      user: active.user,
      id: toStringValue(record.id) ?? String(input.id),
      url: toStringValue(record.url),
      data: {
        monitor: record,
      },
    });
  }

  async incidents(input: IncidentsInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listIncidents({
      cursor: input.cursor,
      monitor_id: input.monitorId,
      monitor_name: input.monitorName,
      started_after: input.startedAfter,
      started_before: input.startedBefore,
    });

    return this.buildActionResult({
      account: active.account,
      action: "incidents",
      message: `Loaded ${payload.data.length} UptimeRobot incident${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        incidents: toRecordArray(payload.data),
        nextLink: payload.nextLink ?? null,
      },
    });
  }

  async incident(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const incident = await active.client.getIncident(input.id);
    const record = toRecord(incident);

    return this.buildActionResult({
      account: active.account,
      action: "incident",
      message: `Loaded incident ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: input.id,
      data: {
        incident: record,
      },
    });
  }

  async integrations(input: IntegrationsInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listIntegrations({
      cursor: input.cursor,
    });

    return this.buildActionResult({
      account: active.account,
      action: "integrations",
      message: `Loaded ${payload.data.length} UptimeRobot integration${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        integrations: toRecordArray(payload.data),
        nextLink: payload.nextLink ?? null,
      },
    });
  }

  async integration(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const integration = await active.client.getIntegration(input.id);
    const record = toRecord(integration);

    return this.buildActionResult({
      account: active.account,
      action: "integration",
      message: `Loaded integration ${describeIntegration(record)}.`,
      sessionPath: active.path,
      user: active.user,
      id: toStringValue(record.id) ?? String(input.id),
      data: {
        integration: record,
      },
    });
  }

  private async ensureActiveConnection(account?: string): Promise<ActiveUptimeRobotConnection> {
    const loaded = await this.loadTokenConnection(account);
    const client = new UptimeRobotApiClient(loaded.token);
    const viewer = await client.getMe();
    const user = this.toSessionUser(viewer) ?? loaded.user;
    const status = this.activeStatus("UptimeRobot API token validated.");
    const path = await this.persistTokenConnection(loaded, {
      user,
      status,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
      },
    });

    return {
      ...loaded,
      path,
      user,
      client,
      viewer,
      metadata: {
        ...(loaded.metadata ?? {}),
        user: this.summarizeUser(viewer),
      },
    };
  }

  private toSessionUser(viewer: UptimeRobotUser): SessionUser | undefined {
    const email = typeof viewer.email === "string" ? viewer.email.trim() : "";
    const username = email.includes("@") ? email.split("@")[0] : undefined;
    const displayName = typeof viewer.fullName === "string" && viewer.fullName.trim().length > 0 ? viewer.fullName.trim() : email || username;

    if (!displayName && !username) {
      return undefined;
    }

    return {
      id: email || undefined,
      username,
      displayName,
    };
  }

  private summarizeUser(viewer: UptimeRobotUser): Record<string, unknown> {
    const email = typeof viewer.email === "string" ? viewer.email.trim() : undefined;
    return {
      email,
      username: email?.split("@")[0],
      displayName: typeof viewer.fullName === "string" && viewer.fullName.trim().length > 0 ? viewer.fullName.trim() : email,
      monitorsCount: viewer.monitorsCount,
      monitorLimit: viewer.monitorLimit,
      smsCredits: viewer.smsCredits,
      plan: viewer.activeSubscription?.plan,
      subscriptionStatus: viewer.activeSubscription?.status,
      subscriptionExpiresAt: viewer.activeSubscription?.expirationDate,
    };
  }
}

export const uptimeRobotAdapter = new UptimeRobotAdapter();

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function describeMonitor(record: Record<string, unknown>): string {
  return toStringValue(record.friendlyName) ?? toStringValue(record.url) ?? toStringValue(record.id) ?? "unknown monitor";
}

function describeIntegration(record: Record<string, unknown>): string {
  return toStringValue(record.friendlyName) ?? toStringValue(record.type) ?? toStringValue(record.id) ?? "unknown integration";
}

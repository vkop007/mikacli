import { MikaCliError } from "../../../errors.js";
import { BaseApiKeyPlatformAdapter, type LoadedApiKeyConnection } from "../shared/base.js";
import { UptimeRobotApiClient, type UptimeRobotPagination, type UptimeRobotUser } from "./client.js";

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

type IncidentCommentsInput = {
  account?: string;
  incidentId: string;
  cursor?: string;
  limit?: number;
};

type IntegrationsInput = {
  account?: string;
  cursor?: number;
};

type CursorInput = {
  account?: string;
  cursor?: number | string;
};

type AnnouncementListInput = {
  account?: string;
  pspId: number;
  status?: string;
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

  async alertContacts(input: { account?: string; all?: boolean }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const items = input.all ? await active.client.getAllAlertContacts() : await active.client.getAlertContacts();
    const key = input.all ? "allAlertContacts" : "alertContacts";
    return this.buildCollectionResult({
      account: active.account,
      action: input.all ? "all-alert-contacts" : "alert-contacts",
      message: `Loaded ${items.length} UptimeRobot alert contact${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: key,
      items,
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
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "monitors",
      message: `Loaded ${payload.data.length} UptimeRobot monitor${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "monitors",
      payload,
    });
  }

  async monitor(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.getMonitor(input.id);
    const record = toRecord(monitor);
    return this.buildEntityActionResult({
      account: active.account,
      action: "monitor",
      message: `Loaded monitor ${describeNamedRecord(record, ["friendlyName", "url", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitor",
      entity: record,
      id: toStringValue(record.id),
      url: toStringValue(record.url),
    });
  }

  async createMonitor(input: { account?: string; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.createMonitor(input.body);
    const record = toRecord(monitor);
    return this.buildEntityActionResult({
      account: active.account,
      action: "create-monitor",
      message: `Created monitor ${describeNamedRecord(record, ["friendlyName", "url", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitor",
      entity: record,
      id: toStringValue(record.id),
      url: toStringValue(record.url),
    });
  }

  async updateMonitor(input: { account?: string; id: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.updateMonitor(input.id, input.body);
    const record = toRecord(monitor);
    return this.buildEntityActionResult({
      account: active.account,
      action: "update-monitor",
      message: `Updated monitor ${describeNamedRecord(record, ["friendlyName", "url", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitor",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
      url: toStringValue(record.url),
    });
  }

  async deleteMonitor(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.deleteMonitor(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "delete-monitor",
      message: `Deleted monitor ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        deleted: true,
        monitorId: input.id,
      },
    });
  }

  async resetMonitor(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.resetMonitor(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "reset-monitor",
      message: `Reset stats for monitor ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        reset: true,
        monitorId: input.id,
      },
    });
  }

  async pause(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.pauseMonitor(input.id);
    const record = toRecord(monitor);
    return this.buildEntityActionResult({
      account: active.account,
      action: "pause",
      message: `Paused monitor ${describeNamedRecord(record, ["friendlyName", "url", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitor",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
      url: toStringValue(record.url),
    });
  }

  async start(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const monitor = await active.client.startMonitor(input.id);
    const record = toRecord(monitor);
    return this.buildEntityActionResult({
      account: active.account,
      action: "start",
      message: `Started monitor ${describeNamedRecord(record, ["friendlyName", "url", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitor",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
      url: toStringValue(record.url),
    });
  }

  async uptimeStats(input: UptimeStatsInput): Promise<AdapterActionResult> {
    if (input.timeFrame === "CUSTOM" && (typeof input.start !== "number" || typeof input.end !== "number")) {
      throw new MikaCliError("UPTIMEROBOT_CUSTOM_TIMEFRAME_REQUIRED", "CUSTOM uptime stats require both --start and --end Unix timestamps.");
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

  async incidents(input: IncidentsInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listIncidents({
      cursor: input.cursor,
      monitor_id: input.monitorId,
      monitor_name: input.monitorName,
      started_after: input.startedAfter,
      started_before: input.startedBefore,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "incidents",
      message: `Loaded ${payload.data.length} UptimeRobot incident${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "incidents",
      payload,
    });
  }

  async incident(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const incident = await active.client.getIncident(input.id);
    return this.buildEntityActionResult({
      account: active.account,
      action: "incident",
      message: `Loaded incident ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "incident",
      entity: toRecord(incident),
      id: input.id,
    });
  }

  async incidentComments(input: IncidentCommentsInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listIncidentComments(input.incidentId, {
      cursor: input.cursor,
      limit: input.limit,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "incident-comments",
      message: `Loaded ${payload.data.length} comment${payload.data.length === 1 ? "" : "s"} for incident ${input.incidentId}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "incidentComments",
      payload,
      extraData: {
        incidentId: input.incidentId,
      },
    });
  }

  async createIncidentComment(input: { account?: string; incidentId: string; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const result = await active.client.createIncidentComment(input.incidentId, input.body);
    return this.buildActionResult({
      account: active.account,
      action: "create-incident-comment",
      message: `Created a comment on incident ${input.incidentId}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        incidentId: input.incidentId,
        incidentComment: toRecord(result),
      },
    });
  }

  async updateIncidentComment(input: { account?: string; incidentId: string; commentId: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const comment = await active.client.updateIncidentComment(input.incidentId, input.commentId, input.body);
    return this.buildEntityActionResult({
      account: active.account,
      action: "update-incident-comment",
      message: `Updated comment ${input.commentId} on incident ${input.incidentId}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "incidentComment",
      entity: toRecord(comment),
      id: String(input.commentId),
    });
  }

  async deleteIncidentComment(input: { account?: string; incidentId: string; commentId: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.deleteIncidentComment(input.incidentId, input.commentId);
    return this.buildActionResult({
      account: active.account,
      action: "delete-incident-comment",
      message: `Deleted comment ${input.commentId} from incident ${input.incidentId}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.commentId),
      data: {
        deleted: true,
        incidentId: input.incidentId,
        commentId: input.commentId,
      },
    });
  }

  async incidentActivityLog(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.getIncidentActivityLog(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "incident-activity-log",
      message: `Loaded activity log for incident ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: input.id,
      data: {
        incidentId: input.id,
        activityLog: toRecord(payload),
      },
    });
  }

  async incidentAlerts(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.getIncidentAlerts(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "incident-alerts",
      message: `Loaded sent alerts for incident ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: input.id,
      data: {
        incidentId: input.id,
        incidentAlerts: toRecord(payload),
      },
    });
  }

  async integrations(input: IntegrationsInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listIntegrations({
      cursor: input.cursor,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "integrations",
      message: `Loaded ${payload.data.length} UptimeRobot integration${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "integrations",
      payload,
    });
  }

  async integration(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const integration = await active.client.getIntegration(input.id);
    const record = toRecord(integration);
    return this.buildEntityActionResult({
      account: active.account,
      action: "integration",
      message: `Loaded integration ${describeNamedRecord(record, ["friendlyName", "type", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "integration",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async createIntegration(input: { account?: string; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const integration = await active.client.createIntegration(input.body);
    const record = toRecord(integration);
    return this.buildEntityActionResult({
      account: active.account,
      action: "create-integration",
      message: `Created integration ${describeNamedRecord(record, ["friendlyName", "type", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "integration",
      entity: record,
      id: toStringValue(record.id),
    });
  }

  async updateIntegration(input: { account?: string; id: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const integration = await active.client.updateIntegration(input.id, input.body);
    const record = toRecord(integration);
    return this.buildEntityActionResult({
      account: active.account,
      action: "update-integration",
      message: `Updated integration ${describeNamedRecord(record, ["friendlyName", "type", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "integration",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async deleteIntegration(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.deleteIntegration(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "delete-integration",
      message: `Deleted integration ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        deleted: true,
        integrationId: input.id,
      },
    });
  }

  async monitorGroups(input: CursorInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listMonitorGroups({
      cursor: input.cursor,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "monitor-groups",
      message: `Loaded ${payload.data.length} UptimeRobot monitor group${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "monitorGroups",
      payload,
    });
  }

  async monitorGroup(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const group = await active.client.getMonitorGroup(input.id);
    const record = toRecord(group);
    return this.buildEntityActionResult({
      account: active.account,
      action: "monitor-group",
      message: `Loaded monitor group ${describeNamedRecord(record, ["name", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitorGroup",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async createMonitorGroup(input: { account?: string; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const group = await active.client.createMonitorGroup(input.body);
    const record = toRecord(group);
    return this.buildEntityActionResult({
      account: active.account,
      action: "create-monitor-group",
      message: `Created monitor group ${describeNamedRecord(record, ["name", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitorGroup",
      entity: record,
      id: toStringValue(record.id),
    });
  }

  async updateMonitorGroup(input: { account?: string; id: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const group = await active.client.updateMonitorGroup(input.id, input.body);
    const record = toRecord(group);
    return this.buildEntityActionResult({
      account: active.account,
      action: "update-monitor-group",
      message: `Updated monitor group ${describeNamedRecord(record, ["name", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "monitorGroup",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async deleteMonitorGroup(input: { account?: string; id: number; monitorsNewGroupId?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.deleteMonitorGroup(input.id, {
      monitorsNewGroupId: input.monitorsNewGroupId,
    });
    return this.buildActionResult({
      account: active.account,
      action: "delete-monitor-group",
      message: `Deleted monitor group ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        deleted: true,
        monitorGroupId: input.id,
        monitorsNewGroupId: input.monitorsNewGroupId ?? 0,
      },
    });
  }

  async maintenanceWindows(input: CursorInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listMaintenanceWindows({
      cursor: input.cursor,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "maintenance-windows",
      message: `Loaded ${payload.data.length} maintenance window${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "maintenanceWindows",
      payload,
    });
  }

  async maintenanceWindow(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const window = await active.client.getMaintenanceWindow(input.id);
    const record = toRecord(window);
    return this.buildEntityActionResult({
      account: active.account,
      action: "maintenance-window",
      message: `Loaded maintenance window ${describeNamedRecord(record, ["name", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "maintenanceWindow",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async createMaintenanceWindow(input: { account?: string; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const window = await active.client.createMaintenanceWindow(input.body);
    const record = toRecord(window);
    return this.buildEntityActionResult({
      account: active.account,
      action: "create-maintenance-window",
      message: `Created maintenance window ${describeNamedRecord(record, ["name", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "maintenanceWindow",
      entity: record,
      id: toStringValue(record.id),
    });
  }

  async updateMaintenanceWindow(input: { account?: string; id: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const window = await active.client.updateMaintenanceWindow(input.id, input.body);
    const record = toRecord(window);
    return this.buildEntityActionResult({
      account: active.account,
      action: "update-maintenance-window",
      message: `Updated maintenance window ${describeNamedRecord(record, ["name", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "maintenanceWindow",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async deleteMaintenanceWindow(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.deleteMaintenanceWindow(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "delete-maintenance-window",
      message: `Deleted maintenance window ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        deleted: true,
        maintenanceWindowId: input.id,
      },
    });
  }

  async psps(input: CursorInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listPsps({
      cursor: input.cursor,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "psps",
      message: `Loaded ${payload.data.length} public status page${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "psps",
      payload,
    });
  }

  async psp(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const psp = await active.client.getPsp(input.id);
    const record = toRecord(psp);
    return this.buildEntityActionResult({
      account: active.account,
      action: "psp",
      message: `Loaded public status page ${describeNamedRecord(record, ["friendlyName", "urlKey", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "psp",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async createPsp(input: { account?: string; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const psp = await active.client.createPsp(input.body);
    const record = toRecord(psp);
    return this.buildEntityActionResult({
      account: active.account,
      action: "create-psp",
      message: `Created public status page ${describeNamedRecord(record, ["friendlyName", "urlKey", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "psp",
      entity: record,
      id: toStringValue(record.id),
    });
  }

  async updatePsp(input: { account?: string; id: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const psp = await active.client.updatePsp(input.id, input.body);
    const record = toRecord(psp);
    return this.buildEntityActionResult({
      account: active.account,
      action: "update-psp",
      message: `Updated public status page ${describeNamedRecord(record, ["friendlyName", "urlKey", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "psp",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
    });
  }

  async deletePsp(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.deletePsp(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "delete-psp",
      message: `Deleted public status page ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        deleted: true,
        pspId: input.id,
      },
    });
  }

  async announcements(input: AnnouncementListInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listAnnouncements(input.pspId, {
      status: input.status,
      cursor: input.cursor,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "announcements",
      message: `Loaded ${payload.data.length} announcement${payload.data.length === 1 ? "" : "s"} for PSP ${input.pspId}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "announcements",
      payload,
      extraData: {
        pspId: input.pspId,
      },
    });
  }

  async announcement(input: { account?: string; pspId: number; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const announcement = await active.client.getAnnouncement(input.pspId, input.id);
    const record = toRecord(announcement);
    return this.buildEntityActionResult({
      account: active.account,
      action: "announcement",
      message: `Loaded announcement ${describeNamedRecord(record, ["title", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "announcement",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
      extraData: {
        pspId: input.pspId,
      },
    });
  }

  async createAnnouncement(input: { account?: string; pspId: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const announcement = await active.client.createAnnouncement(input.pspId, input.body);
    const record = toRecord(announcement);
    return this.buildEntityActionResult({
      account: active.account,
      action: "create-announcement",
      message: `Created announcement ${describeNamedRecord(record, ["title", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "announcement",
      entity: record,
      id: toStringValue(record.id),
      extraData: {
        pspId: input.pspId,
      },
    });
  }

  async updateAnnouncement(input: { account?: string; pspId: number; id: number; body: Record<string, unknown> }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const announcement = await active.client.updateAnnouncement(input.pspId, input.id, input.body);
    const record = toRecord(announcement);
    return this.buildEntityActionResult({
      account: active.account,
      action: "update-announcement",
      message: `Updated announcement ${describeNamedRecord(record, ["title", "id"])}.`,
      sessionPath: active.path,
      user: active.user,
      entityKey: "announcement",
      entity: record,
      id: toStringValue(record.id) ?? String(input.id),
      extraData: {
        pspId: input.pspId,
      },
    });
  }

  async pinAnnouncement(input: { account?: string; pspId: number; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.pinAnnouncement(input.pspId, input.id);
    return this.buildActionResult({
      account: active.account,
      action: "pin-announcement",
      message: `Pinned announcement ${input.id} on PSP ${input.pspId}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        pspId: input.pspId,
        pinned: true,
      },
    });
  }

  async unpinAnnouncement(input: { account?: string; pspId: number; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.unpinAnnouncement(input.pspId, input.id);
    return this.buildActionResult({
      account: active.account,
      action: "unpin-announcement",
      message: `Unpinned announcement ${input.id} on PSP ${input.pspId}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        pspId: input.pspId,
        pinned: false,
      },
    });
  }

  async tags(input: CursorInput): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const payload = await active.client.listTags({
      cursor: input.cursor,
    });
    return this.buildPaginatedCollectionResult({
      account: active.account,
      action: "tags",
      message: `Loaded ${payload.data.length} tag${payload.data.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      listKey: "tags",
      payload,
    });
  }

  async deleteTag(input: { account?: string; id: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await active.client.deleteTag(input.id);
    return this.buildActionResult({
      account: active.account,
      action: "delete-tag",
      message: `Deleted tag ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: String(input.id),
      data: {
        deleted: true,
        tagId: input.id,
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

  private buildPaginatedCollectionResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    listKey: string;
    payload: UptimeRobotPagination<Record<string, unknown>>;
    extraData?: Record<string, unknown>;
  }): AdapterActionResult {
    return this.buildCollectionResult({
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      listKey: input.listKey,
      items: input.payload.data,
      extraData: {
        nextLink: input.payload.nextLink ?? null,
        ...(input.extraData ?? {}),
      },
    });
  }

  private buildCollectionResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    listKey: string;
    items: unknown;
    extraData?: Record<string, unknown>;
  }): AdapterActionResult {
    return this.buildActionResult({
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      data: {
        [input.listKey]: toRecordArray(input.items),
        ...(input.extraData ?? {}),
      },
    });
  }

  private buildEntityActionResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    entityKey: string;
    entity: Record<string, unknown>;
    id?: string;
    url?: string;
    extraData?: Record<string, unknown>;
  }): AdapterActionResult {
    return this.buildActionResult({
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      id: input.id,
      url: input.url,
      data: {
        [input.entityKey]: input.entity,
        ...(input.extraData ?? {}),
      },
    });
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

function describeNamedRecord(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = toStringValue(record[key]);
    if (value) {
      return value;
    }
  }

  return "unknown item";
}

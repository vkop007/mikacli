import { basename } from "node:path";

import { MikaCliError } from "../../../errors.js";
import { appendUploadFileField, readUploadAsset } from "../../../utils/upload-pipeline.js";

type QueryValue = string | number | boolean | null | undefined;
type RequestBodyValue = Record<string, unknown> | FormData | string;
type UptimeRobotRequestInit = Omit<RequestInit, "body"> & {
  body?: RequestBodyValue;
};

export interface UptimeRobotUser {
  email?: string;
  fullName?: string;
  monitorsCount?: number;
  monitorLimit?: number;
  smsCredits?: number;
  activeSubscription?: {
    plan?: string;
    monitorLimit?: number;
    expirationDate?: string;
    status?: string;
  };
}

export interface UptimeRobotPagination<T> {
  data: T[];
  nextLink?: string | null;
}

export interface UptimeRobotMonitor extends Record<string, unknown> {
  id?: number;
  friendlyName?: string | null;
  url?: string | null;
  type?: string;
  status?: string;
  interval?: number;
}

export interface UptimeRobotIncident extends Record<string, unknown> {
  id?: string;
  reason?: string;
  status?: string;
}

export interface UptimeRobotIntegration extends Record<string, unknown> {
  id?: number;
  friendlyName?: string | null;
  type?: string;
  status?: string;
}

export interface UptimeRobotComment extends Record<string, unknown> {
  id?: number;
  comment?: string;
}

export interface UptimeRobotMonitorGroup extends Record<string, unknown> {
  id?: number;
  name?: string;
}

export interface UptimeRobotMaintenanceWindow extends Record<string, unknown> {
  id?: number;
  name?: string;
  status?: string;
}

export interface UptimeRobotPsp extends Record<string, unknown> {
  id?: number;
  friendlyName?: string;
  urlKey?: string;
  status?: string;
}

export interface UptimeRobotAnnouncement extends Record<string, unknown> {
  id?: number;
  title?: string;
  status?: string;
}

export interface UptimeRobotTag extends Record<string, unknown> {
  id?: number;
  name?: string;
}

export class UptimeRobotApiClient {
  private readonly baseUrl = "https://api.uptimerobot.com/v3/";
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly token: string,
    fetchImpl?: typeof fetch,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async getMe(): Promise<UptimeRobotUser> {
    return this.request<UptimeRobotUser>("/user/me");
  }

  async getAlertContacts(): Promise<Record<string, unknown>[]> {
    return this.request<Record<string, unknown>[]>("/user/alert-contacts", { method: "GET" });
  }

  async getAllAlertContacts(): Promise<Record<string, unknown>[]> {
    return this.request<Record<string, unknown>[]>("/user/all-alert-contacts", { method: "GET" });
  }

  async listMonitors(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotMonitor>> {
    return this.request<UptimeRobotPagination<UptimeRobotMonitor>>("/monitors", { method: "GET" }, query);
  }

  async getMonitor(id: number): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>(`/monitors/${id}`);
  }

  async createMonitor(body: Record<string, unknown>): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>("/monitors", {
      method: "POST",
      body,
    });
  }

  async updateMonitor(id: number, body: Record<string, unknown>): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>(`/monitors/${id}`, {
      method: "PATCH",
      body,
    });
  }

  async deleteMonitor(id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/monitors/${id}`, {
      method: "DELETE",
    });
  }

  async resetMonitor(id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/monitors/${id}/reset`, {
      method: "POST",
      body: "{}",
    });
  }

  async pauseMonitor(id: number): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>(`/monitors/${id}/pause`, {
      method: "POST",
      body: "{}",
    });
  }

  async startMonitor(id: number): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>(`/monitors/${id}/start`, {
      method: "POST",
      body: "{}",
    });
  }

  async getUptimeStats(query: Record<string, QueryValue>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/monitors/uptime-stats", { method: "GET" }, query);
  }

  async getMonitorUptimeStats(id: number, query: Record<string, QueryValue> = {}): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/monitors/${id}/stats/uptime`, { method: "GET" }, query);
  }

  async getMonitorResponseTimeStats(id: number, query: Record<string, QueryValue> = {}): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/monitors/${id}/stats/response-time`, { method: "GET" }, query);
  }

  async listIncidents(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotIncident>> {
    return this.request<UptimeRobotPagination<UptimeRobotIncident>>("/incidents", { method: "GET" }, query);
  }

  async getIncident(id: string): Promise<UptimeRobotIncident> {
    return this.request<UptimeRobotIncident>(`/incidents/${encodeURIComponent(id)}`);
  }

  async listIncidentComments(id: string, query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotComment>> {
    return this.request<UptimeRobotPagination<UptimeRobotComment>>(`/incidents/${encodeURIComponent(id)}/comments`, { method: "GET" }, query);
  }

  async createIncidentComment(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/incidents/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body,
    });
  }

  async updateIncidentComment(id: string, commentId: number, body: Record<string, unknown>): Promise<UptimeRobotComment> {
    return this.request<UptimeRobotComment>(`/incidents/${encodeURIComponent(id)}/comments/${commentId}`, {
      method: "PATCH",
      body,
    });
  }

  async deleteIncidentComment(id: string, commentId: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/incidents/${encodeURIComponent(id)}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  async getIncidentActivityLog(id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/incidents/${encodeURIComponent(id)}/activity-log`, { method: "GET" });
  }

  async getIncidentAlerts(id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/incidents/${encodeURIComponent(id)}/alerts`, { method: "GET" });
  }

  async listIntegrations(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotIntegration>> {
    return this.request<UptimeRobotPagination<UptimeRobotIntegration>>("/integrations", { method: "GET" }, query);
  }

  async getIntegration(id: number): Promise<UptimeRobotIntegration> {
    return this.request<UptimeRobotIntegration>(`/integrations/${id}`);
  }

  async createIntegration(body: Record<string, unknown>): Promise<UptimeRobotIntegration> {
    return this.request<UptimeRobotIntegration>("/integrations", {
      method: "POST",
      body,
    });
  }

  async updateIntegration(id: number, body: Record<string, unknown>): Promise<UptimeRobotIntegration> {
    return this.request<UptimeRobotIntegration>(`/integrations/${id}`, {
      method: "PATCH",
      body,
    });
  }

  async deleteIntegration(id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/integrations/${id}`, {
      method: "DELETE",
    });
  }

  async listMonitorGroups(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotMonitorGroup>> {
    return this.request<UptimeRobotPagination<UptimeRobotMonitorGroup>>("/monitor-groups", { method: "GET" }, query);
  }

  async getMonitorGroup(id: number): Promise<UptimeRobotMonitorGroup> {
    return this.request<UptimeRobotMonitorGroup>(`/monitor-groups/${id}`, { method: "GET" });
  }

  async createMonitorGroup(body: Record<string, unknown>): Promise<UptimeRobotMonitorGroup> {
    return this.request<UptimeRobotMonitorGroup>("/monitor-groups", {
      method: "POST",
      body,
    });
  }

  async updateMonitorGroup(id: number, body: Record<string, unknown>): Promise<UptimeRobotMonitorGroup> {
    return this.request<UptimeRobotMonitorGroup>(`/monitor-groups/${id}`, {
      method: "PATCH",
      body,
    });
  }

  async deleteMonitorGroup(id: number, query: Record<string, QueryValue> = {}): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/monitor-groups/${id}`, { method: "DELETE" }, query);
  }

  async listMaintenanceWindows(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotMaintenanceWindow>> {
    return this.request<UptimeRobotPagination<UptimeRobotMaintenanceWindow>>("/maintenance-windows", { method: "GET" }, query);
  }

  async getMaintenanceWindow(id: number): Promise<UptimeRobotMaintenanceWindow> {
    return this.request<UptimeRobotMaintenanceWindow>(`/maintenance-windows/${id}`, { method: "GET" });
  }

  async createMaintenanceWindow(body: Record<string, unknown>): Promise<UptimeRobotMaintenanceWindow> {
    return this.request<UptimeRobotMaintenanceWindow>("/maintenance-windows", {
      method: "POST",
      body,
    });
  }

  async updateMaintenanceWindow(id: number, body: Record<string, unknown>): Promise<UptimeRobotMaintenanceWindow> {
    return this.request<UptimeRobotMaintenanceWindow>(`/maintenance-windows/${id}`, {
      method: "PATCH",
      body,
    });
  }

  async deleteMaintenanceWindow(id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/maintenance-windows/${id}`, {
      method: "DELETE",
    });
  }

  async listPsps(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotPsp>> {
    return this.request<UptimeRobotPagination<UptimeRobotPsp>>("/psps", { method: "GET" }, query);
  }

  async getPsp(id: number): Promise<UptimeRobotPsp> {
    return this.request<UptimeRobotPsp>(`/psps/${id}`, { method: "GET" });
  }

  async createPsp(body: Record<string, unknown>): Promise<UptimeRobotPsp> {
    return this.request<UptimeRobotPsp>("/psps", {
      method: "POST",
      body: await toMultipartFormData(body),
    });
  }

  async updatePsp(id: number, body: Record<string, unknown>): Promise<UptimeRobotPsp> {
    return this.request<UptimeRobotPsp>(`/psps/${id}`, {
      method: "PATCH",
      body: await toMultipartFormData(body),
    });
  }

  async deletePsp(id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/psps/${id}`, {
      method: "DELETE",
    });
  }

  async listAnnouncements(pspId: number, query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotAnnouncement>> {
    return this.request<UptimeRobotPagination<UptimeRobotAnnouncement>>(`/psps/${pspId}/announcements`, { method: "GET" }, query);
  }

  async getAnnouncement(pspId: number, id: number): Promise<UptimeRobotAnnouncement> {
    return this.request<UptimeRobotAnnouncement>(`/psps/${pspId}/announcements/${id}`, { method: "GET" });
  }

  async createAnnouncement(pspId: number, body: Record<string, unknown>): Promise<UptimeRobotAnnouncement> {
    return this.request<UptimeRobotAnnouncement>(`/psps/${pspId}/announcements`, {
      method: "POST",
      body,
    });
  }

  async updateAnnouncement(pspId: number, id: number, body: Record<string, unknown>): Promise<UptimeRobotAnnouncement> {
    return this.request<UptimeRobotAnnouncement>(`/psps/${pspId}/announcements/${id}`, {
      method: "PATCH",
      body,
    });
  }

  async pinAnnouncement(pspId: number, id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/psps/${pspId}/announcements/${id}/pin`, {
      method: "POST",
    });
  }

  async unpinAnnouncement(pspId: number, id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/psps/${pspId}/announcements/${id}/unpin`, {
      method: "POST",
    });
  }

  async listTags(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotTag>> {
    return this.request<UptimeRobotPagination<UptimeRobotTag>>("/tags", { method: "GET" }, query);
  }

  async deleteTag(id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/tags/${id}`, {
      method: "DELETE",
    });
  }

  private async request<T>(
    path: string,
    init: UptimeRobotRequestInit = {},
    query: Record<string, QueryValue> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const headers = new Headers(init.headers);
    const body = await normalizeBody(init.body, headers);
    headers.set("authorization", `Bearer ${this.token}`);
    headers.set("accept", "application/json");
    headers.set("user-agent", "MikaCLI/0.1 (+https://github.com/vkop007/mikacli)");

    const response = await this.fetchImpl(url, {
      ...init,
      headers,
      body,
    });

    const text = await response.text();
    const payload = text.length > 0 ? safeJsonParse(text) : {};

    if (!response.ok) {
      throw new MikaCliError("UPTIMEROBOT_API_ERROR", extractErrorMessage(payload, response.status), {
        details: {
          path,
          status: response.status,
        },
      });
    }

    if (text.length > 0 && payload === undefined) {
      throw new MikaCliError("UPTIMEROBOT_API_ERROR", "UptimeRobot returned a non-JSON response.", {
        details: { path },
      });
    }

    return payload as T;
  }

  private buildUrl(path: string, query: Record<string, QueryValue>): string {
    const url = new URL(path.replace(/^\/+/u, ""), this.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }

      const normalized = typeof value === "string" ? value.trim() : String(value);
      if (normalized.length === 0) {
        continue;
      }

      url.searchParams.set(key, normalized);
    }

    return url.toString();
  }
}

async function normalizeBody(body: RequestBodyValue | undefined, headers: Headers): Promise<BodyInit | undefined> {
  if (body === undefined) {
    return undefined;
  }

  if (body instanceof FormData) {
    headers.delete("content-type");
    return body;
  }

  if (typeof body === "string") {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return body;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return JSON.stringify(body);
}

async function toMultipartFormData(payload: Record<string, unknown>): Promise<FormData> {
  const formData = new FormData();
  await appendFormValue(formData, "", payload);
  return formData;
}

async function appendFormValue(formData: FormData, key: string, value: unknown): Promise<void> {
  if (value === undefined || value === null) {
    return;
  }

  if (isFileDescriptor(value)) {
    const fileName = value.filename?.trim() || basename(value.filePath);
    const asset = await readUploadAsset(value.filePath, {
      mimeType: value.contentType,
      details: {
        field: key,
      },
    });
    appendUploadFileField(formData, key, asset, fileName);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      await appendFormValue(formData, `${key}[]`, entry);
    }
    return;
  }

  if (isRecord(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      const nextKey = key ? `${key}[${childKey}]` : childKey;
      await appendFormValue(formData, nextKey, childValue);
    }
    return;
  }

  formData.append(key, String(value));
}

type FileDescriptor = {
  filePath: string;
  filename?: string;
  contentType?: string;
};

function isFileDescriptor(value: unknown): value is FileDescriptor {
  return isRecord(value) && typeof value.filePath === "string" && value.filePath.trim().length > 0;
}

function safeJsonParse(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    if (Array.isArray(payload.message)) {
      const messages = payload.message
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim());
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }

    const direct = [payload.message, payload.error, payload.details].find((value) => typeof value === "string" && value.trim().length > 0);

    if (typeof direct === "string") {
      return direct.trim();
    }

    if (Array.isArray(payload.errors)) {
      const nested = payload.errors.find((value) => isRecord(value) && typeof value.message === "string");
      if (isRecord(nested) && typeof nested.message === "string" && nested.message.trim().length > 0) {
        return nested.message.trim();
      }
    }
  }

  return `UptimeRobot API request failed with status ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

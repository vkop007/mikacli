import { AutoCliError } from "../../../errors.js";

type QueryValue = string | number | boolean | null | undefined;

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

  async listMonitors(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotMonitor>> {
    return this.request<UptimeRobotPagination<UptimeRobotMonitor>>("/monitors", { method: "GET" }, query);
  }

  async getMonitor(id: number): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>(`/monitors/${id}`);
  }

  async createMonitor(body: Record<string, unknown>): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>("/monitors", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateMonitor(id: number, body: Record<string, unknown>): Promise<UptimeRobotMonitor> {
    return this.request<UptimeRobotMonitor>(`/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
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

  async listIntegrations(query: Record<string, QueryValue> = {}): Promise<UptimeRobotPagination<UptimeRobotIntegration>> {
    return this.request<UptimeRobotPagination<UptimeRobotIntegration>>("/integrations", { method: "GET" }, query);
  }

  async getIntegration(id: number): Promise<UptimeRobotIntegration> {
    return this.request<UptimeRobotIntegration>(`/integrations/${id}`);
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    query: Record<string, QueryValue> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.token}`);
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");
    headers.set("user-agent", "AutoCLI/0.1 (+https://github.com/vkop007/autocli)");

    const response = await this.fetchImpl(url, {
      ...init,
      headers,
    });

    const text = await response.text();
    const payload = text.length > 0 ? safeJsonParse(text) : {};

    if (!response.ok) {
      throw new AutoCliError("UPTIMEROBOT_API_ERROR", extractErrorMessage(payload, response.status), {
        details: {
          path,
          status: response.status,
        },
      });
    }

    if (text.length > 0 && payload === undefined) {
      throw new AutoCliError("UPTIMEROBOT_API_ERROR", "UptimeRobot returned a non-JSON response.", {
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

function safeJsonParse(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const direct = [payload.message, payload.error, payload.details]
      .find((value) => typeof value === "string" && value.trim().length > 0);

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

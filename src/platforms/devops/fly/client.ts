import { BearerJsonClient, extractArray, isObject } from "../shared/rest.js";

export interface FlyApp {
  id?: string;
  name?: string;
  organization?: {
    slug?: string;
    name?: string;
  };
  status?: string;
  hostname?: string;
}

export interface FlyMachine {
  id?: string;
  name?: string;
  state?: string;
  region?: string;
  image_ref?: {
    repository?: string;
    tag?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface FlyVolume {
  id?: string;
  name?: string;
  region?: string;
  state?: string;
  size_gb?: number;
  created_at?: string;
}

export interface FlyCertificate {
  hostname?: string;
  configured?: boolean;
  certificate_authority?: string;
  source?: string;
  created_at?: string;
}

export class FlyApiClient {
  private readonly client: BearerJsonClient;

  constructor(token: string, fetchImpl?: typeof fetch) {
    this.client = new BearerJsonClient({
      baseUrl: "https://api.machines.dev",
      token,
      errorCode: "FLY_API_ERROR",
      fetchImpl,
    });
  }

  async listApps(orgSlug: string): Promise<FlyApp[]> {
    const payload = await this.client.request<unknown>(`/v1/apps?org_slug=${encodeURIComponent(orgSlug)}`);
    return extractArray<FlyApp>(payload, ["apps"]);
  }

  async getApp(appName: string): Promise<FlyApp> {
    const payload = await this.client.request<unknown>(`/v1/apps/${encodeURIComponent(appName)}`);
    if (isObject(payload)) {
      return payload as FlyApp;
    }

    return {};
  }

  async listMachines(appName: string): Promise<FlyMachine[]> {
    const payload = await this.client.request<unknown>(`/v1/apps/${encodeURIComponent(appName)}/machines`);
    return extractArray<FlyMachine>(payload, ["machines"]);
  }

  async listVolumes(appName: string): Promise<FlyVolume[]> {
    const payload = await this.client.request<unknown>(`/v1/apps/${encodeURIComponent(appName)}/volumes`);
    return extractArray<FlyVolume>(payload, ["volumes"]);
  }

  async listCertificates(appName: string): Promise<FlyCertificate[]> {
    const payload = await this.client.request<unknown>(`/v1/apps/${encodeURIComponent(appName)}/certificates`);
    return extractArray<FlyCertificate>(payload, ["certificates"]);
  }
}

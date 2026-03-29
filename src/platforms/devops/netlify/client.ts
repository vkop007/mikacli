import { BearerJsonClient, extractArray, isObject } from "../shared/rest.js";

export interface NetlifyUser {
  id?: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface NetlifyAccount {
  id?: string;
  name?: string;
  slug?: string;
  type_name?: string;
}

export interface NetlifySite {
  id?: string;
  name?: string;
  account_name?: string;
  ssl_url?: string;
  url?: string;
  admin_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NetlifyDeploy {
  id?: string;
  name?: string;
  state?: string;
  deploy_url?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
  context?: string;
}

export interface NetlifyDnsZone {
  id?: string;
  name?: string;
  account_id?: string;
  created_at?: string;
  updated_at?: string;
}

export class NetlifyApiClient {
  private readonly client: BearerJsonClient;

  constructor(token: string, fetchImpl?: typeof fetch) {
    this.client = new BearerJsonClient({
      baseUrl: "https://api.netlify.com/api/v1",
      token,
      errorCode: "NETLIFY_API_ERROR",
      fetchImpl,
    });
  }

  async getUser(): Promise<NetlifyUser> {
    const payload = await this.client.request<unknown>("/user");
    if (isObject(payload)) {
      return payload as NetlifyUser;
    }

    return {};
  }

  async listAccounts(limit = 20): Promise<NetlifyAccount[]> {
    const payload = await this.client.request<unknown>(`/accounts?per_page=${Math.min(limit, 100)}`);
    return extractArray<NetlifyAccount>(payload, ["accounts"]);
  }

  async listSites(limit = 20): Promise<NetlifySite[]> {
    const payload = await this.client.request<unknown>(`/sites?per_page=${Math.min(limit, 100)}`);
    return extractArray<NetlifySite>(payload, ["sites"]);
  }

  async listDeploys(siteId: string, limit = 20): Promise<NetlifyDeploy[]> {
    const payload = await this.client.request<unknown>(`/sites/${encodeURIComponent(siteId)}/deploys?per_page=${Math.min(limit, 100)}`);
    return extractArray<NetlifyDeploy>(payload, ["deploys"]);
  }

  async listDnsZones(limit = 20): Promise<NetlifyDnsZone[]> {
    const payload = await this.client.request<unknown>(`/dns_zones?per_page=${Math.min(limit, 100)}`);
    return extractArray<NetlifyDnsZone>(payload, ["zones", "dns_zones"]);
  }
}

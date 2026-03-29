import { BearerJsonClient, extractArray, isObject } from "../shared/rest.js";

export interface DigitalOceanAccount {
  uuid?: string;
  email?: string;
  email_verified?: boolean;
  status?: string;
}

export interface DigitalOceanApp {
  id?: string;
  spec?: {
    name?: string;
  };
  region?: {
    slug?: string;
  };
  default_ingress?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DigitalOceanDeployment {
  id?: string;
  phase?: string;
  cause?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DigitalOceanDomain {
  name?: string;
  ttl?: number;
  zone_file?: string;
}

export class DigitalOceanApiClient {
  private readonly client: BearerJsonClient;

  constructor(token: string, fetchImpl?: typeof fetch) {
    this.client = new BearerJsonClient({
      baseUrl: "https://api.digitalocean.com/v2",
      token,
      errorCode: "DIGITALOCEAN_API_ERROR",
      fetchImpl,
    });
  }

  async getAccount(): Promise<DigitalOceanAccount> {
    const payload = await this.client.request<unknown>("/account");
    if (isObject(payload) && isObject(payload.account)) {
      return payload.account as DigitalOceanAccount;
    }

    if (isObject(payload)) {
      return payload as DigitalOceanAccount;
    }

    return {};
  }

  async listApps(limit = 20): Promise<DigitalOceanApp[]> {
    const payload = await this.client.request<unknown>(`/apps?page=1&per_page=${Math.min(limit, 100)}`);
    return extractArray<DigitalOceanApp>(payload, ["apps"]);
  }

  async listDeployments(appId: string, limit = 20): Promise<DigitalOceanDeployment[]> {
    const payload = await this.client.request<unknown>(`/apps/${encodeURIComponent(appId)}/deployments?page=1&per_page=${Math.min(limit, 100)}`);
    return extractArray<DigitalOceanDeployment>(payload, ["deployments"]);
  }

  async listDomains(limit = 20): Promise<DigitalOceanDomain[]> {
    const payload = await this.client.request<unknown>(`/domains?page=1&per_page=${Math.min(limit, 100)}`);
    return extractArray<DigitalOceanDomain>(payload, ["domains"]);
  }
}

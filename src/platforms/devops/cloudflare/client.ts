import { MikaCliError } from "../../../errors.js";

export interface CloudflareTokenVerification {
  id?: string;
  status?: string;
  not_before?: string;
  expires_on?: string;
  issued_on?: string;
}

export interface CloudflareAccount {
  id: string;
  name: string;
  type?: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status?: string;
  account?: {
    id?: string;
    name?: string;
  };
  plan?: {
    name?: string;
  };
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content?: string;
  ttl?: number;
  proxied?: boolean;
  comment?: string;
  modified_on?: string;
}

type CloudflareEnvelope<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
};

export class CloudflareApiClient {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async verifyToken(): Promise<CloudflareTokenVerification> {
    return this.request<CloudflareTokenVerification>("/user/tokens/verify");
  }

  async listAccounts(limit = 20): Promise<CloudflareAccount[]> {
    return this.request<CloudflareAccount[]>(`/accounts?per_page=${Math.min(limit, 100)}`);
  }

  async listZones(limit = 20): Promise<CloudflareZone[]> {
    return this.request<CloudflareZone[]>(`/zones?per_page=${Math.min(limit, 100)}`);
  }

  async listDnsRecords(zoneId: string, limit = 20): Promise<CloudflareDnsRecord[]> {
    return this.request<CloudflareDnsRecord[]>(`/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=${Math.min(limit, 100)}`);
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`https://api.cloudflare.com/client/v4${path}`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "MikaCLI/0.1 (+https://github.com/vkop007/mikacli)",
      },
    });

    const payload = (await response.json().catch(() => undefined)) as CloudflareEnvelope<T> | undefined;
    if (!response.ok || !payload?.success || payload.result === undefined) {
      const message = payload?.errors?.map((error) => error.message).filter((value): value is string => typeof value === "string" && value.length > 0)[0]
        ?? `Cloudflare API request failed with status ${response.status}.`;
      throw new MikaCliError("CLOUDFLARE_API_ERROR", message, {
        details: {
          status: response.status,
          path,
        },
      });
    }

    return payload.result;
  }
}

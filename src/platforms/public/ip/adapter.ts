import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

type IpVersion = "4" | "6" | "any";

type IpLookupInput = {
  version?: string;
  details?: boolean;
};

type IpDetails = {
  city?: string;
  country?: string;
  countryCode?: string;
  org?: string;
  provider: string;
};

export class IpAdapter {
  readonly platform: Platform = "ip" as Platform;
  readonly displayName = "IP";

  async ip(input: IpLookupInput): Promise<AdapterActionResult> {
    const version = normalizeIpVersion(input.version);
    const ipLookup = await this.lookupPublicIp(version);
    const resolvedVersion = detectIpVersion(ipLookup.ip);

    let details: IpDetails | undefined;
    let detailsError: string | undefined;
    if (input.details) {
      const detailLookup = await this.lookupDetails(ipLookup.ip);
      details = detailLookup.details;
      detailsError = detailLookup.error;
    }

    const message = buildMessage({
      ip: ipLookup.ip,
      detailsRequested: Boolean(input.details),
      detailsLoaded: Boolean(details),
    });

    return this.buildResult({
      action: "ip",
      message,
      data: {
        ip: ipLookup.ip,
        requestedVersion: version,
        resolvedVersion,
        source: ipLookup.source,
        detailsRequested: Boolean(input.details),
        details: details ?? null,
        detailsError: detailsError ?? null,
      },
    });
  }

  private async lookupPublicIp(version: IpVersion): Promise<{ ip: string; source: string }> {
    const endpoints = resolveIpEndpoints(version);
    const errors: string[] = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          signal: AbortSignal.timeout(10000),
          headers: {
            accept: "application/json",
            "user-agent": "AutoCLI/1.0 (+https://github.com/)",
          },
        });

        if (!response.ok) {
          errors.push(`${endpoint.name}: ${response.status} ${response.statusText}`);
          continue;
        }

        const payload = (await response.json()) as { ip?: unknown };
        const ip = typeof payload.ip === "string" ? payload.ip.trim() : "";

        if (!ip) {
          errors.push(`${endpoint.name}: invalid JSON payload`);
          continue;
        }

        return {
          ip,
          source: endpoint.url,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        errors.push(`${endpoint.name}: ${message}`);
      }
    }

    throw new AutoCliError("IP_LOOKUP_FAILED", "Unable to determine your public IP address.", {
      details: {
        requestedVersion: version,
        errors,
      },
    });
  }

  private async lookupDetails(ip: string): Promise<{ details?: IpDetails; error?: string }> {
    const providers = [
      {
        id: "ipapi",
        name: "ipapi.co",
        url: `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      },
      {
        id: "ipwhois",
        name: "ipwhois.app",
        url: `https://ipwhois.app/json/${encodeURIComponent(ip)}`,
      },
    ] as const;

    const errors: string[] = [];

    for (const provider of providers) {
      try {
        const response = await fetch(provider.url, {
          signal: AbortSignal.timeout(10000),
          headers: {
            accept: "application/json",
            "user-agent": "AutoCLI/1.0 (+https://github.com/)",
          },
        });

        if (!response.ok) {
          errors.push(`${provider.name}: ${response.status} ${response.statusText}`);
          continue;
        }

        const payload = await response.json();
        const details = parseIpDetails(provider.id, payload);
        if (details) {
          return {
            details,
          };
        }

        errors.push(`${provider.name}: missing country/city/org details`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        errors.push(`${provider.name}: ${message}`);
      }
    }

    return {
      error: errors.length > 0 ? errors.join("; ") : "No detail provider returned usable data.",
    };
  }

  private buildResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const ipAdapter = new IpAdapter();

function resolveIpEndpoints(version: IpVersion): ReadonlyArray<{ name: string; url: string }> {
  if (version === "4") {
    return [
      { name: "ipify (v4)", url: "https://api.ipify.org?format=json" },
      { name: "ipify (dual)", url: "https://api64.ipify.org?format=json" },
    ];
  }

  if (version === "6") {
    return [
      { name: "ipify (v6)", url: "https://api6.ipify.org?format=json" },
      { name: "ipify (dual)", url: "https://api64.ipify.org?format=json" },
      { name: "ipify (v4)", url: "https://api.ipify.org?format=json" },
    ];
  }

  return [
    { name: "ipify (dual)", url: "https://api64.ipify.org?format=json" },
    { name: "ipify (v4)", url: "https://api.ipify.org?format=json" },
  ];
}

function normalizeIpVersion(value: string | undefined): IpVersion {
  const normalized = value?.trim().toLowerCase() || "any";
  if (normalized === "4" || normalized === "6" || normalized === "any") {
    return normalized;
  }

  throw new AutoCliError(
    "IP_VERSION_INVALID",
    `Invalid IP version "${value}". Supported versions: 4, 6, any.`,
    {
      details: {
        version: value,
      },
    },
  );
}

function parseIpDetails(provider: "ipapi" | "ipwhois", payload: unknown): IpDetails | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const details: IpDetails = {
    provider: provider === "ipapi" ? "ipapi.co" : "ipwhois.app",
  };

  if (provider === "ipapi") {
    details.city = normalizeOptionalString(asString(record.city));
    details.country = normalizeOptionalString(asString(record.country_name)) ?? normalizeOptionalString(asString(record.country));
    details.countryCode = normalizeOptionalString(asString(record.country_code));
    details.org = normalizeOptionalString(asString(record.org)) ?? normalizeOptionalString(asString(record.asn));
  } else {
    details.city = normalizeOptionalString(asString(record.city));
    details.country = normalizeOptionalString(asString(record.country));
    details.countryCode = normalizeOptionalString(asString(record.country_code));
    details.org = normalizeOptionalString(asString(record.org)) ?? normalizeOptionalString(asString(record.isp));
  }

  if (!details.city && !details.country && !details.org) {
    return undefined;
  }

  return details;
}

function detectIpVersion(ip: string): IpVersion | "unknown" {
  if (ip.includes(":")) {
    return "6";
  }

  if (ip.includes(".")) {
    return "4";
  }

  return "unknown";
}

function buildMessage(input: { ip: string; detailsRequested: boolean; detailsLoaded: boolean }): string {
  if (!input.detailsRequested) {
    return `Loaded public IP ${input.ip}.`;
  }

  return input.detailsLoaded
    ? `Loaded public IP ${input.ip} with network details.`
    : `Loaded public IP ${input.ip}. Details were unavailable.`;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

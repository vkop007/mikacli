import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

export type DnsLookupInput = {
  name: string;
  type?: string;
};

export type DnsAnswer = {
  name: string;
  type: string;
  ttl?: number;
  data: string;
};

export class DnsAdapter {
  readonly platform: Platform = "dns" as Platform;
  readonly displayName = "DNS";

  async resolve(input: DnsLookupInput): Promise<AdapterActionResult> {
    const name = normalizeDnsName(input.name);
    const type = normalizeDnsType(input.type);
    const url = buildDnsResolveUrl({ name, type });
    const payload = await fetchDnsJson(url);
    const answers = parseDnsAnswers(payload);
    const status = typeof payload.Status === "number" ? payload.Status : undefined;
    const statusText = getDnsStatusText(status);

    if (answers.length === 0) {
      throw new AutoCliError(
        "DNS_LOOKUP_FAILED",
        `No DNS answers were returned for ${name}.`,
        {
          details: {
            name,
            type,
            status,
            statusText,
            comment: typeof payload.Comment === "string" ? payload.Comment : undefined,
          },
        },
      );
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "resolve",
      message: `Resolved ${name} (${type}).`,
      data: {
        name,
        type,
        status,
        statusText,
        answers,
        authority: parseDnsSection(payload.Authority),
        additional: parseDnsSection(payload.Additional),
        dnssec: Boolean(payload.AD),
        source: url,
      },
    };
  }
}

export const dnsAdapter = new DnsAdapter();

export function buildDnsResolveUrl(input: { name: string; type: string }): string {
  const url = new URL("https://dns.google/resolve");
  url.searchParams.set("name", input.name);
  url.searchParams.set("type", input.type);
  return url.toString();
}

export function normalizeDnsName(value: string): string {
  const name = value.trim().replace(/\.+$/u, "");
  if (!name) {
    throw new AutoCliError("DNS_NAME_REQUIRED", "DNS lookup name cannot be empty.");
  }

  return name;
}

export function normalizeDnsType(value?: string): string {
  const type = (value ?? "A").trim().toUpperCase();
  if (!type) {
    return "A";
  }

  if (!/^[A-Z0-9]+$/u.test(type)) {
    throw new AutoCliError("DNS_TYPE_INVALID", `Invalid DNS record type "${value}".`);
  }

  return type;
}

export function parseDnsAnswers(payload: unknown): DnsAnswer[] {
  const record = asRecord(payload);
  const answers = asRecordArray(record.Answer);
  const parsed: DnsAnswer[] = [];

  for (const answer of answers) {
    const name = asString(answer.name);
    const typeCode = asNumber(answer.type);
    const data = asString(answer.data);

    if (!name || !typeCode || !data) {
      continue;
    }

    const next: DnsAnswer = {
      name,
      type: dnsTypeCodeToName(typeCode),
      data,
    };

    const ttl = asNumber(answer.TTL);
    if (ttl !== undefined) {
      next.ttl = ttl;
    }

    parsed.push(next);
  }

  return parsed;
}

function parseDnsSection(value: unknown): Array<Record<string, unknown>> | undefined {
  const items = asRecordArray(value);
  return items.length > 0 ? items : undefined;
}

async function fetchDnsJson(url: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: "application/dns-json",
        "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new AutoCliError("DNS_LOOKUP_FAILED", "Unable to reach the DNS lookup service.", {
      cause: error,
      details: {
        url,
      },
    });
  }

  if (!response.ok) {
    throw new AutoCliError("DNS_LOOKUP_FAILED", `DNS lookup failed with ${response.status} ${response.statusText}.`, {
      details: {
        url,
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  try {
    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    throw new AutoCliError("DNS_RESPONSE_INVALID", "DNS lookup returned invalid JSON.", {
      cause: error,
      details: {
        url,
      },
    });
  }
}

function dnsTypeCodeToName(typeCode: number): string {
  const mapping: Record<number, string> = {
    1: "A",
    2: "NS",
    5: "CNAME",
    6: "SOA",
    12: "PTR",
    15: "MX",
    16: "TXT",
    28: "AAAA",
    33: "SRV",
    35: "NAPTR",
    41: "OPT",
    43: "DS",
    46: "RRSIG",
    47: "NSEC",
    48: "DNSKEY",
    257: "CAA",
  };

  return mapping[typeCode] ?? `TYPE${typeCode}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Array<Record<string, unknown> & { ttl?: number }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> & { ttl?: number } => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getDnsStatusText(status: number | undefined): string {
  switch (status) {
    case 0:
      return "NOERROR";
    case 1:
      return "FORMERR";
    case 2:
      return "SERVFAIL";
    case 3:
      return "NXDOMAIN";
    case 4:
      return "NOTIMP";
    case 5:
      return "REFUSED";
    default:
      return "UNKNOWN";
  }
}

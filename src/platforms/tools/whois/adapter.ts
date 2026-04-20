import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

type WhoisTargetKind = "domain" | "ip";

export type WhoisLookupInput = {
  target: string;
};

export type WhoisEvent = {
  action: string;
  date?: string;
};

export type WhoisResult = {
  target: string;
  kind: WhoisTargetKind;
  sourceUrl: string;
  objectClassName?: string;
  handle?: string;
  ldhName?: string;
  status: string[];
  registrar?: string;
  nameservers: string[];
  events: WhoisEvent[];
  notices: string[];
};

export class WhoisAdapter {
  readonly platform: Platform = "whois" as Platform;
  readonly displayName = "Whois";

  async lookup(input: WhoisLookupInput): Promise<AdapterActionResult> {
    const target = normalizeWhoisTarget(input.target);
    const kind = detectWhoisTargetKind(target);
    const sourceUrl = buildWhoisSourceUrl(kind, target);
    const payload = await fetchWhoisJson(sourceUrl);
    const result = parseWhoisResult(payload, { kind, target, sourceUrl });

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "lookup",
      message: `Loaded WHOIS data for ${target}.`,
      data: result,
    };
  }
}

export const whoisAdapter = new WhoisAdapter();

export function normalizeWhoisTarget(value: string): string {
  const target = value.trim().toLowerCase();
  if (!target) {
    throw new MikaCliError("WHOIS_TARGET_REQUIRED", "WHOIS lookup target cannot be empty.");
  }

  return target;
}

export function detectWhoisTargetKind(target: string): WhoisTargetKind {
  if (isIpAddress(target)) {
    return "ip";
  }

  return "domain";
}

export function buildWhoisSourceUrl(kind: WhoisTargetKind, target: string): string {
  return kind === "ip"
    ? `https://rdap.org/ip/${encodeURIComponent(target)}`
    : `https://rdap.org/domain/${encodeURIComponent(target)}`;
}

export function parseWhoisResult(payload: unknown, meta: { kind: WhoisTargetKind; target: string; sourceUrl: string }): WhoisResult {
  const record = asRecord(payload);
  const nameservers = asRecordArray(record.nameservers)
    .map((entry) => asString(entry.ldhName) ?? asString(entry.name))
    .filter((value): value is string => Boolean(value));
  const status = asStringArray(record.status);
  const events = asRecordArray(record.events)
    .map((entry) => ({
      action: asString(entry.eventAction) ?? "unknown",
      date: asString(entry.eventDate),
    }))
    .filter((event) => event.action !== "unknown" || Boolean(event.date));

  return {
    target: meta.target,
    kind: meta.kind,
    sourceUrl: meta.sourceUrl,
    objectClassName: asString(record.objectClassName),
    handle: asString(record.handle),
    ldhName: asString(record.ldhName),
    status,
    registrar: pickWhoisRegistrar(record.entities),
    nameservers,
    events,
    notices: parseWhoisNotices(record.notices),
  };
}

function pickWhoisRegistrar(entities: unknown): string | undefined {
  for (const entity of asRecordArray(entities)) {
    const roles = asStringArray(entity.roles).map((role) => role.toLowerCase());
    if (!roles.some((role) => role.includes("registrar") || role.includes("sponsoring"))) {
      continue;
    }

    const name = extractVcardOrg(entity.vcardArray);
    if (name) {
      return name;
    }
  }

  return undefined;
}

function parseWhoisNotices(notices: unknown): string[] {
  return asRecordArray(notices)
    .map((entry) => {
      const title = asString(entry.title);
      const description = asStringArray(entry.description).join(" ").trim();
      if (title && description) {
        return `${title}: ${description}`;
      }

      return title ?? description;
    })
    .filter((value): value is string => Boolean(value));
}

async function fetchWhoisJson(url: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        accept: "application/rdap+json, application/json;q=0.9, */*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new MikaCliError("WHOIS_LOOKUP_FAILED", "Unable to reach the WHOIS lookup service.", {
      cause: error,
      details: { url },
    });
  }

  if (!response.ok) {
    throw new MikaCliError("WHOIS_LOOKUP_FAILED", `WHOIS lookup failed with ${response.status} ${response.statusText}.`, {
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
    throw new MikaCliError("WHOIS_RESPONSE_INVALID", "WHOIS lookup returned invalid JSON.", {
      cause: error,
      details: { url },
    });
  }
}

function extractVcardOrg(vcardArray: unknown): string | undefined {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2) {
    return undefined;
  }

  const entries = vcardArray[1];
  if (!Array.isArray(entries)) {
    return undefined;
  }

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 4) {
      continue;
    }

    const [name, , , value] = entry;
    if (typeof name === "string" && name === "fn" && typeof value === "string") {
      return value;
    }

    if (typeof name === "string" && name === "org" && Array.isArray(value)) {
      const org = value.find((part) => typeof part === "string");
      if (typeof org === "string") {
        return org;
      }
    }
  }

  return undefined;
}

function isIpAddress(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/u.test(value) || /^[0-9a-f:]+$/iu.test(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

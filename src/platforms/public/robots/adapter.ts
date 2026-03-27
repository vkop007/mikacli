import { AutoCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type RobotsInspectInput = {
  url: string;
  followSitemaps?: boolean;
};

export class RobotsAdapter {
  readonly platform = "robots" as unknown as Platform;
  readonly displayName = "Robots";

  async inspect(input: RobotsInspectInput): Promise<AdapterActionResult> {
    const robotsUrl = normalizeRobotsUrl(input.url);
    const text = await fetchRobotsText(robotsUrl);
    const parsed = parseRobotsTxt(text);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "inspect",
      message: `Loaded robots.txt from ${robotsUrl}.`,
      url: robotsUrl,
      data: {
        robotsUrl,
        userAgents: parsed.userAgents,
        rules: parsed.rules,
        sitemaps: parsed.sitemaps,
        raw: text,
        sourceUrl: robotsUrl,
        followSitemaps: Boolean(input.followSitemaps),
      },
    };
  }
}

export const robotsAdapter = new RobotsAdapter();

export function normalizeRobotsUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AutoCliError("ROBOTS_URL_REQUIRED", "Robots URL cannot be empty.");
  }

  try {
    const parsed = new URL(trimmed);
    if (/robots\.txt$/i.test(parsed.pathname)) {
      return parsed.toString();
    }
    parsed.pathname = parsed.pathname.replace(/\/?$/, "/robots.txt");
    return parsed.toString();
  } catch {
    const parsed = new URL(`https://${trimmed}`);
    if (/robots\.txt$/i.test(parsed.pathname)) {
      return parsed.toString();
    }
    parsed.pathname = parsed.pathname.replace(/\/?$/, "/robots.txt");
    return parsed.toString();
  }
}

export async function fetchRobotsText(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        accept: "text/plain,text/*;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new AutoCliError("ROBOTS_REQUEST_FAILED", "Unable to reach the robots.txt URL.", {
      details: { url },
      cause: error,
    });
  }

  if (!response.ok) {
    throw new AutoCliError("ROBOTS_REQUEST_FAILED", `robots.txt request failed with ${response.status} ${response.statusText}.`, {
      details: { url, status: response.status, statusText: response.statusText },
    });
  }

  return response.text();
}

export function parseRobotsTxt(text: string): {
  userAgents: string[];
  rules: Array<{ userAgent: string; allow: string[]; disallow: string[]; crawlDelay?: number }>;
  sitemaps: string[];
} {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.replace(/#.*/u, "").trim())
    .filter(Boolean);

  const rules: Array<{ userAgent: string; allow: string[]; disallow: string[]; crawlDelay?: number }> = [];
  const userAgents = new Set<string>();
  const sitemaps = new Set<string>();
  let currentRule: { userAgent: string; allow: string[]; disallow: string[]; crawlDelay?: number } | undefined;

  for (const line of lines) {
    const [rawKey, ...rawValueParts] = line.split(":");
    if (!rawKey || rawValueParts.length === 0) {
      continue;
    }

    const key = rawKey.trim().toLowerCase();
    const value = rawValueParts.join(":").trim();

    switch (key) {
      case "user-agent":
        if (!currentRule || currentRule.allow.length > 0 || currentRule.disallow.length > 0 || currentRule.crawlDelay !== undefined) {
          currentRule = { userAgent: value || "*", allow: [], disallow: [] };
          rules.push(currentRule);
        } else {
          currentRule.userAgent = value || "*";
        }
        userAgents.add(value || "*");
        break;
      case "allow":
        ensureRule(currentRule).allow.push(value);
        break;
      case "disallow":
        ensureRule(currentRule).disallow.push(value);
        break;
      case "crawl-delay": {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          ensureRule(currentRule).crawlDelay = parsed;
        }
        break;
      }
      case "sitemap":
        if (value) {
          sitemaps.add(value);
        }
        break;
      default:
        break;
    }
  }

  return {
    userAgents: [...userAgents],
    rules,
    sitemaps: [...sitemaps],
  };
}

function ensureRule(
  rule: { userAgent: string; allow: string[]; disallow: string[]; crawlDelay?: number } | undefined,
): { userAgent: string; allow: string[]; disallow: string[]; crawlDelay?: number } {
  if (!rule) {
    throw new AutoCliError("ROBOTS_PARSE_FAILED", "robots.txt does not declare a user-agent block before a rule.");
  }

  return rule;
}

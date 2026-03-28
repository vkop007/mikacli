import { AutoCliError } from "../../../errors.js";
import { htmlToText, normalizeWhitespace } from "../../data/shared/text.js";

const DEFAULT_INSTANCE_ORIGIN = "https://mastodon.social";

export type MastodonSearchTarget = {
  baseUrl: string;
  handle?: string;
  statusId?: string;
  url?: string;
};

export type MastodonProfileTarget = {
  origin: string;
  acct: string;
  username: string;
  url?: string;
};

export type MastodonStatusTarget = {
  origin: string;
  statusId: string;
  username?: string;
  url?: string;
};

export function normalizeMastodonOrigin(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return DEFAULT_INSTANCE_ORIGIN;
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    return new URL(trimmed).origin;
  }

  return `https://${trimmed.replace(/^\/+/u, "").replace(/\/+$/u, "")}`;
}

export function normalizeMastodonInstanceUrl(target: string): string {
  return normalizeMastodonOrigin(target);
}

export function parseMastodonSearchTarget(target: string): MastodonSearchTarget {
  const trimmed = normalizePotentialMastodonUrl(target.trim());
  if (!trimmed) {
    throw new AutoCliError("MASTODON_TARGET_INVALID", "Mastodon target cannot be empty.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const profileMatch = url.pathname.match(/^\/@([^/]+)(?:\/(\d+))?\/?$/u);
    const usersMatch = url.pathname.match(/^\/users\/([^/]+)(?:\/statuses\/(\d+))?\/?$/u);
    const handle = profileMatch?.[1] ?? usersMatch?.[1];
    const statusId = profileMatch?.[2] ?? usersMatch?.[2];
    return {
      baseUrl: url.origin,
      ...(handle ? { handle: decodeURIComponent(handle) } : {}),
      ...(statusId ? { statusId } : {}),
      url: url.toString(),
    };
  }

  const profileTarget = normalizeMastodonProfileTarget(trimmed);
  return {
    baseUrl: profileTarget.origin,
    handle: profileTarget.acct,
    url: profileTarget.url,
  };
}

export function normalizeMastodonProfileTarget(target: string): MastodonProfileTarget {
  const trimmed = normalizePotentialMastodonUrl(target.trim());
  if (!trimmed) {
    throw new AutoCliError("MASTODON_TARGET_INVALID", "Expected a Mastodon profile URL, handle, or username.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    return parseProfileUrl(trimmed);
  }

  const handle = trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
  if (!handle) {
    throw new AutoCliError("MASTODON_TARGET_INVALID", "Mastodon handle cannot be empty.");
  }

  if (/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(handle)) {
    const parts = handle.split("@", 2);
    const username = parts[0];
    const host = parts[1];
    if (!username || !host) {
      throw new AutoCliError("MASTODON_TARGET_INVALID", "Expected a Mastodon profile URL, handle, or username.");
    }
    return {
      origin: normalizeMastodonOrigin(host),
      acct: `${username}@${host}`,
      username,
    };
  }

  if (/^[A-Za-z0-9._-]+$/u.test(handle)) {
    return {
      origin: DEFAULT_INSTANCE_ORIGIN,
      acct: handle,
      username: handle,
    };
  }

  throw new AutoCliError("MASTODON_TARGET_INVALID", "Expected a Mastodon profile URL, handle, or username.");
}

export function normalizeMastodonStatusTarget(target: string): MastodonStatusTarget {
  const trimmed = normalizePotentialMastodonUrl(target.trim());
  if (!trimmed) {
    throw new AutoCliError("MASTODON_TARGET_INVALID", "Expected a Mastodon status URL or status ID.");
  }

  if (/^\d+$/u.test(trimmed)) {
    return {
      origin: DEFAULT_INSTANCE_ORIGIN,
      statusId: trimmed,
    };
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);

    const webHandleIndex = segments.findIndex((segment) => segment.startsWith("@"));
    if (webHandleIndex >= 0) {
      const username = segments[webHandleIndex]!.slice(1);
      const statusId = segments[webHandleIndex + 1];
      if (username && statusId && /^\d+$/u.test(statusId)) {
        return {
          origin: url.origin,
          username,
          statusId,
          url: url.toString(),
        };
      }
    }

    const legacyMatch = /\/users\/([^/]+)\/statuses\/(\d+)/iu.exec(url.pathname);
    if (legacyMatch?.[1] && legacyMatch[2]) {
      return {
        origin: url.origin,
        username: legacyMatch[1],
        statusId: legacyMatch[2],
        url: url.toString(),
      };
    }

    const numericMatch = /\/statuses\/(\d+)/iu.exec(url.pathname);
    if (numericMatch?.[1]) {
      return {
        origin: url.origin,
        statusId: numericMatch[1],
        url: url.toString(),
      };
    }
  }

  const handleMatch = trimmed.match(/^@?([A-Za-z0-9._-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\/(\d+)$/u);
  if (handleMatch?.[1] && handleMatch[2] && handleMatch[3]) {
    return {
      origin: normalizeMastodonOrigin(handleMatch[2]),
      username: handleMatch[1],
      statusId: handleMatch[3],
    };
  }

  throw new AutoCliError("MASTODON_TARGET_INVALID", "Expected a Mastodon status URL or numeric status ID.");
}

export function buildMastodonProfileUrl(origin: string, username: string): string {
  return `${normalizeMastodonOrigin(origin)}/@${encodeURIComponent(username)}`;
}

export function buildMastodonStatusUrl(origin: string, username: string, statusId: string): string {
  return `${normalizeMastodonOrigin(origin)}/@${encodeURIComponent(username)}/${encodeURIComponent(statusId)}`;
}

export function summarizeMastodonHtml(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const text = normalizeWhitespace(htmlToText(value));
  return text.length > 0 ? text : undefined;
}

export function trimPreview(value: string | undefined | null, max = 320): string | undefined {
  const summary = summarizeMastodonHtml(value);
  if (!summary) {
    return undefined;
  }

  return summary.length > max ? `${summary.slice(0, max - 3)}...` : summary;
}

export function formatCompactNumber(value: number | undefined | null): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function parseProfileUrl(target: string): MastodonProfileTarget {
  const url = new URL(target);
  const segments = url.pathname.split("/").filter(Boolean);

  const webHandle = segments.find((segment) => segment.startsWith("@"));
  if (webHandle) {
    const username = webHandle.slice(1);
    if (!username) {
      throw new AutoCliError("MASTODON_TARGET_INVALID", `Could not resolve a Mastodon profile handle from "${target}".`);
    }

    const acct = normalizeMastodonOrigin(url.origin) === DEFAULT_INSTANCE_ORIGIN ? username : `${username}@${url.hostname}`;
    return {
      origin: url.origin,
      acct,
      username,
      url: url.toString(),
    };
  }

  const legacyMatch = /\/users\/([^/]+)/iu.exec(url.pathname);
  if (legacyMatch?.[1]) {
    const username = legacyMatch[1];
    const acct = normalizeMastodonOrigin(url.origin) === DEFAULT_INSTANCE_ORIGIN ? username : `${username}@${url.hostname}`;
    return {
      origin: url.origin,
      acct,
      username,
      url: url.toString(),
    };
  }

  throw new AutoCliError("MASTODON_TARGET_INVALID", `Could not resolve a Mastodon profile handle from "${target}".`);
}

function normalizePotentialMastodonUrl(value: string): string {
  if (/^https?:\/\//iu.test(value)) {
    return value;
  }

  if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/@/u.test(value) || /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/users\//u.test(value)) {
    return `https://${value}`;
  }

  return value;
}

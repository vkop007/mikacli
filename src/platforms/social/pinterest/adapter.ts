import { MikaCliError } from "../../../errors.js";
import { collapseWhitespace } from "../../shopping/shared/helpers.js";
import { normalizeSocialLimit } from "../shared/options.js";

import type { AdapterActionResult } from "../../../types.js";

const PINTEREST_ORIGIN = "https://www.pinterest.com";
const PINTEREST_READABLE_PREFIX = "https://r.jina.ai/http://";
const PINTEREST_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface PinterestProfile {
  displayName: string;
  username: string;
  bio?: string;
  followers?: string;
  following?: string;
  url: string;
}

interface PinterestSocialItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  text?: string;
  publishedAt?: string;
  username?: string;
  metrics?: string[];
}

interface PinterestThread extends PinterestSocialItem {
  sourceDomain?: string;
  board?: string;
}

export class PinterestAdapter {
  readonly platform = "pinterest" as const;
  readonly displayName = "Pinterest";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("PINTEREST_QUERY_REQUIRED", "Provide a Pinterest query to search.");
    }

    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const markdown = await this.fetchReadable(`${PINTEREST_ORIGIN}/search/pins/?q=${encodeURIComponent(query)}`);
    const items = parsePinterestSearchResults(markdown).slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} Pinterest result${items.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        items,
      },
    };
  }

  async profileInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = parsePinterestProfileTarget(input.target);
    const url = `${PINTEREST_ORIGIN}/${resolved.username}/`;
    const markdown = await this.fetchReadable(url);
    const profile = parsePinterestProfile(markdown, url, resolved.username);
    const boards = parsePinterestBoards(markdown, [profile.displayName, profile.username]);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "profile",
      message: `Loaded Pinterest profile ${profile.username}.`,
      id: profile.username,
      url: profile.url,
      user: {
        id: profile.username,
        username: profile.username,
        displayName: profile.displayName,
        profileUrl: profile.url,
      },
      data: {
        profile: {
          ...profile,
          posts: boards.length > 0 ? `${boards.length} public boards` : undefined,
        },
      },
    };
  }

  async posts(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parsePinterestProfileTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const url = `${PINTEREST_ORIGIN}/${resolved.username}/`;
    const markdown = await this.fetchReadable(url);
    const profile = parsePinterestProfile(markdown, url, resolved.username);
    const items = parsePinterestBoards(markdown, [profile.displayName, profile.username]).slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "posts",
      message: `Loaded ${items.length} Pinterest board${items.length === 1 ? "" : "s"} for ${profile.username}.`,
      data: {
        target: profile.username,
        items,
      },
    };
  }

  async threadInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parsePinterestPinTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const url = `${PINTEREST_ORIGIN}/pin/${resolved.pinId}/`;
    const markdown = await this.fetchReadable(url);
    const thread = parsePinterestPin(markdown, url);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "thread",
      message: `Loaded Pinterest pin ${thread.id}.`,
      id: thread.id,
      url: thread.url,
      data: {
        thread,
        replies: parsePinterestReplies(markdown).slice(0, limit),
      },
    };
  }

  private async fetchReadable(target: string): Promise<string> {
    const sourceUrl = /^https?:\/\//i.test(target) ? target : `${PINTEREST_ORIGIN}${target.startsWith("/") ? target : `/${target}`}`;
    let response: Response;
    try {
      response = await fetch(`${PINTEREST_READABLE_PREFIX}${sourceUrl.replace(/^https?:\/\//, "")}`, {
        headers: {
          "user-agent": PINTEREST_USER_AGENT,
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      throw new MikaCliError("PINTEREST_REQUEST_FAILED", "Failed to load Pinterest's public page.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("PINTEREST_REQUEST_FAILED", "Failed to load Pinterest's public page.", {
        details: {
          sourceUrl,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return text;
  }
}

function parsePinterestProfileTarget(target: string): { username: string } {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new MikaCliError("INVALID_TARGET", "Expected a Pinterest profile URL, @username, or username.", {
      details: { target },
    });
  }

  const urlMatch = trimmed.match(/pinterest\.com\/(?!pin\/|search\/|ideas\/|shopping\/)([A-Za-z0-9._-]+)\/?$/i);
  if (urlMatch?.[1]) {
    return {
      username: urlMatch[1],
    };
  }

  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (/^[A-Za-z0-9._-]+$/.test(normalized)) {
    return {
      username: normalized,
    };
  }

  throw new MikaCliError("INVALID_TARGET", "Expected a Pinterest profile URL, @username, or username.", {
    details: { target },
  });
}

function parsePinterestPinTarget(target: string): { pinId: string } {
  const trimmed = target.trim();
  if (/^\d+$/.test(trimmed)) {
    return {
      pinId: trimmed,
    };
  }

  const match = trimmed.match(/pinterest\.com\/pin\/(\d+)\/?/i);
  if (match?.[1]) {
    return {
      pinId: match[1],
    };
  }

  throw new MikaCliError("INVALID_TARGET", "Expected a Pinterest pin URL or numeric pin ID.", {
    details: { target },
  });
}

function parsePinterestProfile(markdown: string, url: string, fallbackUsername: string): PinterestProfile {
  const lines = cleanPinterestLines(markdown);
  const usernameIndex = lines.findIndex((line) => line.toLowerCase() === fallbackUsername.toLowerCase());
  const displayName = usernameIndex > 0 ? (lines[usernameIndex - 1] ?? fallbackUsername) : fallbackUsername;
  const followers = findNearbyLine(lines, usernameIndex, /followers$/i);
  const following = findNearbyLine(lines, usernameIndex, /following$/i);
  const bio = findProfileBio(lines, usernameIndex);

  return {
    displayName,
    username: fallbackUsername,
    followers,
    following,
    bio,
    url,
  };
}

function parsePinterestBoards(markdown: string, ownerNames: string[]): PinterestSocialItem[] {
  const items: PinterestSocialItem[] = [];
  const seen = new Set<string>();

  for (const line of markdown.split("\n")) {
    if (!line.includes("## ") || !line.includes(" Pins") || !line.includes("pinterest.com/")) {
      continue;
    }

    const urlMatch = line.match(/\]\((https?:\/\/www\.pinterest\.com\/[^)]+)\)$/);
    if (!urlMatch?.[1]) {
      continue;
    }

    const url = urlMatch[1];
    if (seen.has(url)) {
      continue;
    }

    const content = line.replace(/^\[/, "").replace(/\]\((https?:\/\/www\.pinterest\.com\/[^)]+)\)$/, "");
    const withoutImages = content.replace(/!\[[^\]]*]\([^)]+\)\s*/g, "").trim();
    const titleIndex = withoutImages.indexOf("## ");
    if (titleIndex === -1) {
      continue;
    }

    const raw = withoutImages.slice(titleIndex + 3).trim();
    const parts = raw.split(/\s*,\s*/);
    const pins = parts.find((part) => /\bPins\b/i.test(part));
    const sections = parts.find((part) => /\bsections?\b/i.test(part));
    const updated = parts.at(-1);
    const title = normalizeBoardTitle(parts[0] ?? raw, ownerNames);
    if (!title) {
      continue;
    }

    seen.add(url);
    items.push({
      id: extractPinterestBoardId(url),
      title,
      summary: [pins, sections, updated].filter((value): value is string => Boolean(value && value.length > 0)).join(" • ") || undefined,
      url,
    });
  }

  return items;
}

function parsePinterestSearchResults(markdown: string): PinterestSocialItem[] {
  const lines = markdown.split("\n").map((line) => line.trim());
  const items: PinterestSocialItem[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    const match = line.match(/^\[!\[Image \d+(?:: ([^\]]+))?]\((https?:\/\/[^)]+)\)]\((https?:\/\/www\.pinterest\.com\/pin\/(\d+)\/)\)$/);
    if (!match?.[3] || !match[4]) {
      continue;
    }

    if (seen.has(match[3])) {
      continue;
    }

    const title = findPinterestPinTitle(lines, index, match[3], match[1]);
    seen.add(match[3]);
    items.push({
      id: match[4],
      title: title ?? `Pin ${match[4]}`,
      summary: collapseWhitespace(match[1]),
      url: match[3],
    });
  }

  return items;
}

function parsePinterestPin(markdown: string, url: string): PinterestThread {
  const id = url.match(/\/pin\/(\d+)/)?.[1] ?? url;
  const title = markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? `Pin ${id}`;
  const publishedAt = markdown.match(/^Published Time:\s*(.+)$/m)?.[1]?.trim();
  const descriptionMatch = markdown.match(/### Description\s+([\s\S]*?)(?:\n### |\n## |\n\[|\Z)/m);
  const description = collapseWhitespace(descriptionMatch?.[1] ?? "");
  const sourceDomain = extractPinterestSourceDomain(markdown);
  const board = extractPinterestBoardSummary(markdown);
  const metrics = extractPinterestMetrics(markdown);
  const username = markdown.match(/\[([^\]]+)]\(http:\/\/www\.pinterest\.com\/([^/)]+)\/\)\s*\n\n## \d+ Comments/m)?.[2] ?? undefined;

  return {
    id,
    title,
    text: description || extractPinterestLeadText(markdown),
    publishedAt,
      username,
      summary: [sourceDomain, board].filter((value): value is string => Boolean(value && value.length > 0)).join(" • ") || undefined,
      metrics,
      sourceDomain,
      board,
      url,
  };
}

function parsePinterestReplies(markdown: string): Array<Record<string, unknown>> {
  const lines = markdown.split("\n").map((line) => line.trim());
  const commentsIndex = lines.findIndex((line) => /^## \d+ Comments$/i.test(line));
  if (commentsIndex === -1) {
    return [];
  }

  const replies: Array<Record<string, unknown>> = [];
  for (let index = commentsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    if (/^Add a comment$/i.test(line) || /^## More about this Pin$/i.test(line)) {
      break;
    }

    const authorMatch = line.match(/^\[([^\]]+)]\(http:\/\/www\.pinterest\.com\/([^/)]+)\/?\)$/);
    if (!authorMatch?.[1] || !authorMatch[2]) {
      continue;
    }

    const text = findNextPlainText(lines, index + 1);
    if (!text) {
      continue;
    }

    replies.push({
      id: `${authorMatch[2]}-${replies.length + 1}`,
      title: authorMatch[1],
      username: authorMatch[2],
      text,
      url: `${PINTEREST_ORIGIN}/${authorMatch[2]}/`,
    });
    index += 1;
  }

  return replies;
}

function findPinterestPinTitle(lines: string[], startIndex: number, url: string, fallback: string | undefined): string | undefined {
  for (let index = startIndex + 1; index <= startIndex + 3 && index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    const match = line.match(/^\[([^\]]+)]\((https:\/\/www\.pinterest\.com\/pin\/\d+\/)\)$/);
    if (match?.[1] && match[2] === url && match[1].trim().length > 0) {
      return collapseWhitespace(match[1]);
    }
  }

  return collapseWhitespace(fallback);
}

function normalizeBoardTitle(value: string, ownerNames: string[]): string {
  let title = collapseWhitespace(value);
  for (const ownerName of ownerNames) {
    if (!ownerName) {
      continue;
    }

    const pattern = new RegExp(`\\s+${escapeRegExp(ownerName)}(?:\\s+\\+\\s+\\d+)?$`, "i");
    title = title.replace(pattern, "").trim();
  }

  return title;
}

function cleanPinterestLines(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }
      if (line.startsWith("Title: ") || line.startsWith("URL Source: ") || line === "Markdown Content:") {
        return false;
      }
      if (line.startsWith("[Skip to content]") || line.startsWith("When autocomplete")) {
        return false;
      }
      if (line.startsWith("[](") || line.startsWith("![Image")) {
        return false;
      }
      return true;
    });
}

function findNearbyLine(lines: string[], pivot: number, pattern: RegExp): string | undefined {
  for (let index = Math.max(0, pivot); index < Math.min(lines.length, pivot + 8); index += 1) {
    if (pattern.test(lines[index] ?? "")) {
      return collapseWhitespace(lines[index]);
    }
  }

  return undefined;
}

function findProfileBio(lines: string[], usernameIndex: number): string | undefined {
  for (let index = usernameIndex + 1; index < Math.min(lines.length, usernameIndex + 8); index += 1) {
    const line = lines[index];
    if (!line || /followers$|following$/i.test(line) || line === "·" || line.startsWith("[")) {
      continue;
    }
    return collapseWhitespace(line);
  }

  return undefined;
}

function findNextPlainText(lines: string[], startIndex: number): string | undefined {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 5); index += 1) {
    const line = lines[index];
    if (!line || line.startsWith("[") || line.startsWith("![") || line === "⎯⎯" || /^View \d+ replies$/i.test(line)) {
      continue;
    }

    return collapseWhitespace(line);
  }

  return undefined;
}

function extractPinterestSourceDomain(markdown: string): string | undefined {
  const titleMatch = markdown.match(/^# (.+)$/m);
  if (!titleMatch) {
    return undefined;
  }

  const prefix = markdown.slice(0, titleMatch.index ?? 0);
  const lines = prefix.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(line)) {
      return line;
    }
  }

  return undefined;
}

function extractPinterestLeadText(markdown: string): string | undefined {
  const titleMatch = markdown.match(/^# .+$/m);
  if (!titleMatch) {
    return undefined;
  }

  const afterTitle = markdown.slice((titleMatch.index ?? 0) + titleMatch[0].length);
  const lines = afterTitle.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === "·" && lines[index + 1]) {
      return collapseWhitespace(lines[index + 1]);
    }
  }

  return undefined;
}

function extractPinterestBoardSummary(markdown: string): string | undefined {
  const match = markdown.match(/### Board containing this Pin\s+\[[^\]]+]\(http:\/\/www\.pinterest\.com\/[^)]+\)/m);
  if (!match?.[0]) {
    return undefined;
  }

  return collapseWhitespace(match[0].replace(/^### Board containing this Pin\s+/, "").replace(/\(http:\/\/www\.pinterest\.com\/[^)]+\)/, ""));
}

function extractPinterestMetrics(markdown: string): string[] | undefined {
  const metrics: string[] = [];
  const labels = ["Saves", "Likes", "Shares", "Comments"] as const;
  for (const label of labels) {
    const match = markdown.match(new RegExp(`(?:##\\s*)?(\\d[\\d.,kKmM]*)\\s+${label}`, "i"));
    if (match?.[1]) {
      metrics.push(`${match[1]} ${label.toLowerCase()}`);
    }
  }

  return metrics.length > 0 ? metrics : undefined;
}

function extractPinterestBoardId(url: string): string {
  const match = url.match(/pinterest\.com\/([^/]+)\/([^/?#]+)\/?/i);
  return match ? `${match[1]}/${match[2]}` : url;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const pinterestAdapter = new PinterestAdapter();

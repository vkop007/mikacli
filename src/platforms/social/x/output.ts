import { printJson } from "../../../utils/output.js";
import { printActionResult } from "../../../utils/cli.js";

import type { AdapterActionResult } from "../../../types.js";

export function printXTweetListResult(result: AdapterActionResult, json: boolean, key = "results"): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.[key]) ? result.data[key] : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      text?: string;
      authorUsername?: string;
      likeCount?: number;
      retweetCount?: number;
      replyCount?: number;
      createdAt?: string;
      url?: string;
    };

    const meta = [
      typeof item.authorUsername === "string" ? `@${item.authorUsername}` : undefined,
      typeof item.likeCount === "number" ? `${item.likeCount} likes` : undefined,
      typeof item.retweetCount === "number" ? `${item.retweetCount} reposts` : undefined,
      typeof item.replyCount === "number" ? `${item.replyCount} replies` : undefined,
      typeof item.createdAt === "string" ? item.createdAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${item.url ?? "X post"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof item.text === "string" && item.text.length > 0) {
      const preview = item.text.length > 240 ? `${item.text.slice(0, 240)}...` : item.text;
      console.log(`   ${preview.replace(/\s+/g, " ").trim()}`);
    }
  }
}

export function printXTweetResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.authorUsername === "string" ? `@${data.authorUsername}` : undefined,
    typeof data.likeCount === "number" ? `${data.likeCount} likes` : undefined,
    typeof data.retweetCount === "number" ? `${data.retweetCount} reposts` : undefined,
    typeof data.replyCount === "number" ? `${data.replyCount} replies` : undefined,
    typeof data.viewCount === "number" ? `${data.viewCount} views` : undefined,
    typeof data.createdAt === "string" ? data.createdAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.text === "string" && data.text.length > 0) {
    console.log(data.text);
  }
}

export function printXUserResultList(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      username?: string;
      displayName?: string;
      followersCount?: number;
      followingCount?: number;
      tweetCount?: number;
      verified?: boolean;
      url?: string;
    };

    const meta = [
      typeof item.displayName === "string" ? item.displayName : undefined,
      typeof item.followersCount === "number" ? `${item.followersCount} followers` : undefined,
      typeof item.followingCount === "number" ? `${item.followingCount} following` : undefined,
      typeof item.tweetCount === "number" ? `${item.tweetCount} posts` : undefined,
      item.verified ? "verified" : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. @${item.username ?? "unknown"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof item.url === "string" && item.url.length > 0) {
      console.log(`   ${item.url}`);
    }
  }
}

export function printXProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.displayName === "string" ? data.displayName : undefined,
    typeof data.followersCount === "number" ? `${data.followersCount} followers` : undefined,
    typeof data.followingCount === "number" ? `${data.followingCount} following` : undefined,
    typeof data.tweetCount === "number" ? `${data.tweetCount} posts` : undefined,
    data.verified ? "verified" : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 300 ? `${data.description.slice(0, 300)}...` : data.description;
    console.log(preview);
  }
}

export function printXStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  if (typeof data.status === "string") {
    console.log(`status: ${data.status}`);
  }

  if (typeof data.connected === "boolean") {
    console.log(`connected: ${data.connected ? "yes" : "no"}`);
  }

  if (typeof data.lastValidatedAt === "string") {
    console.log(`lastValidatedAt: ${data.lastValidatedAt}`);
  }

  if (typeof data.details === "string" && data.details.length > 0) {
    console.log(`details: ${data.details}`);
  }
}

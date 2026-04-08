import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printTwitchStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data ?? {};
  if (typeof data.status === "string") {
    console.log(`status: ${data.status}`);
  }
  if (typeof data.connected === "boolean") {
    console.log(`connected: ${data.connected ? "yes" : "no"}`);
  }
  if (typeof data.login === "string" && data.login.length > 0) {
    console.log(`login: ${data.login}`);
  }
  if (typeof data.details === "string" && data.details.length > 0) {
    console.log(`details: ${data.details}`);
  }
  if (typeof data.lastValidatedAt === "string" && data.lastValidatedAt.length > 0) {
    console.log(`lastValidatedAt: ${data.lastValidatedAt}`);
  }
}

export function printTwitchProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const profile = asRecord(result.data?.profile) ?? asRecord(result.data?.entity);
  if (!profile) {
    return;
  }

  for (const [label, key] of [
    ["displayName", "displayName"],
    ["username", "username"],
    ["bio", "bio"],
    ["followers", "followers"],
    ["partner", "partner"],
    ["affiliate", "affiliate"],
    ["live", "live"],
    ["viewers", "viewersCount"],
    ["visibility", "visibility"],
    ["profileImageUrl", "profileImageUrl"],
    ["bannerImageUrl", "bannerImageUrl"],
    ["trailerUrl", "trailerUrl"],
    ["latestVideoUrl", "latestVideoUrl"],
    ["topClipUrl", "topClipUrl"],
    ["url", "url"],
  ] as const) {
    const value = profile[key];
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      console.log(`${label}: ${value}`);
    }
  }

  if (typeof profile.schedule === "string" && profile.schedule.length > 0) {
    console.log(`schedule: ${profile.schedule}`);
  }

  if (Array.isArray(profile.socialLinks) && profile.socialLinks.length > 0) {
    console.log(`socialLinks: ${profile.socialLinks.join(", ")}`);
  }
}

export function printTwitchStreamResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const stream = asRecord(result.data?.stream) ?? asRecord(result.data?.entity);
  if (!stream) {
    return;
  }

  for (const [label, key] of [
    ["username", "username"],
    ["displayName", "displayName"],
    ["live", "live"],
    ["title", "title"],
    ["game", "game"],
    ["viewers", "viewersCount"],
    ["startedAt", "startedAt"],
    ["previewImageUrl", "previewImageUrl"],
    ["url", "url"],
  ] as const) {
    const value = stream[key];
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      console.log(`${label}: ${value}`);
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

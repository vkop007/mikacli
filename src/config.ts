import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { Platform } from "./types.js";

export const MIKACLI_DIR = join(homedir(), ".mikacli");
export const SESSIONS_DIR = join(MIKACLI_DIR, "sessions");
export const CONNECTIONS_DIR = join(MIKACLI_DIR, "connections");
export const JOBS_DIR = join(MIKACLI_DIR, "jobs");
export const CACHE_DIR = join(MIKACLI_DIR, "cache");
export const BROWSER_DIR = join(MIKACLI_DIR, "browser");
export const LOGS_DIR = join(MIKACLI_DIR, "logs");
export const ACTION_LOG_PATH = join(LOGS_DIR, "actions.jsonl");
export const SESSION_FILE_VERSION = 1 as const;
export const DEFAULT_ACCOUNT_NAME = "default";
export const DEFAULT_BROWSER_PROFILE = "default";

export function sanitizeAccountName(input: string): string {
  const normalized = input.trim().toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || DEFAULT_ACCOUNT_NAME;
}

export function getPlatformSessionDir(platform: Platform): string {
  return join(SESSIONS_DIR, platform);
}

export function getPlatformConnectionDir(platform: Platform): string {
  return join(CONNECTIONS_DIR, platform);
}

export function getSessionPath(platform: Platform, account: string): string {
  return join(getPlatformSessionDir(platform), `${sanitizeAccountName(account)}.json`);
}

export function getConnectionPath(platform: Platform, account: string): string {
  return join(getPlatformConnectionDir(platform), `${sanitizeAccountName(account)}.json`);
}

export function getPlatformJobDir(platform: Platform): string {
  return join(JOBS_DIR, platform);
}

export function getJobPath(platform: Platform, jobId: string): string {
  return join(getPlatformJobDir(platform), `${sanitizeAccountName(jobId)}.json`);
}

export function getCachePath(...segments: string[]): string {
  return join(CACHE_DIR, ...segments);
}

export function getBrowserProfileDir(profile = DEFAULT_BROWSER_PROFILE): string {
  return join(BROWSER_DIR, sanitizeAccountName(profile));
}

export function getBrowserStatePath(profile = DEFAULT_BROWSER_PROFILE): string {
  return join(getBrowserProfileDir(profile), "state.json");
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function ensureSessionDirectory(platform?: Platform): Promise<void> {
  if (platform) {
    await ensureDirectory(getPlatformSessionDir(platform));
    return;
  }

  await ensureDirectory(SESSIONS_DIR);
}

export async function ensureConnectionDirectory(platform?: Platform): Promise<void> {
  if (platform) {
    await ensureDirectory(getPlatformConnectionDir(platform));
    return;
  }

  await ensureDirectory(CONNECTIONS_DIR);
}

export async function ensureJobDirectory(platform?: Platform): Promise<void> {
  if (platform) {
    await ensureDirectory(getPlatformJobDir(platform));
    return;
  }

  await ensureDirectory(JOBS_DIR);
}

export async function ensureCacheDirectory(...segments: string[]): Promise<void> {
  await ensureDirectory(join(CACHE_DIR, ...segments));
}

export async function ensureBrowserDirectory(profile?: string): Promise<void> {
  if (profile) {
    await ensureDirectory(getBrowserProfileDir(profile));
    return;
  }

  await ensureDirectory(BROWSER_DIR);
}

export async function ensureLogDirectory(): Promise<void> {
  await ensureDirectory(LOGS_DIR);
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await ensureDirectory(dirname(filePath));
}

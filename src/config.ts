import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { Platform } from "./types.js";

export const AUTOCLI_DIR = join(homedir(), ".autocli");
export const SESSIONS_DIR = join(AUTOCLI_DIR, "sessions");
export const CONNECTIONS_DIR = join(AUTOCLI_DIR, "connections");
export const CACHE_DIR = join(AUTOCLI_DIR, "cache");
export const SESSION_FILE_VERSION = 1 as const;
export const DEFAULT_ACCOUNT_NAME = "default";

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

export function getCachePath(...segments: string[]): string {
  return join(CACHE_DIR, ...segments);
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

export async function ensureCacheDirectory(...segments: string[]): Promise<void> {
  await ensureDirectory(join(CACHE_DIR, ...segments));
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await ensureDirectory(dirname(filePath));
}

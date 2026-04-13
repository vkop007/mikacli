import { GENERATED_PLATFORM_DISPLAY_NAMES, GENERATED_PLATFORM_NAMES } from "./generated-metadata.js";
import { getGeneratedPlatformConfig } from "./generated-runtime-config.js";

export const PLATFORM_NAMES = GENERATED_PLATFORM_NAMES;

export type PlatformName = (typeof GENERATED_PLATFORM_NAMES)[number];

export interface PlatformConfig {
  origin: string;
  homeUrl: string;
  cookieDomain: string;
  authCookieNames: readonly string[];
  browserAuthCookieNames?: readonly string[];
  browserReadyCookieNames?: readonly string[];
  browserAuthStorageKeys?: readonly string[];
}

export const PLATFORM_CONFIG: Record<PlatformName, PlatformConfig> = getGeneratedPlatformConfig();

const PLATFORM_NAME_SET = new Set<string>(PLATFORM_NAMES);

export function isPlatform(value: string): value is PlatformName {
  return PLATFORM_NAME_SET.has(value);
}

export function getPlatformConfig(platform: PlatformName): PlatformConfig {
  return PLATFORM_CONFIG[platform];
}

export function getPlatformDisplayName(platform: PlatformName): string {
  return GENERATED_PLATFORM_DISPLAY_NAMES[platform];
}

export function getPlatformOrigin(platform: PlatformName): string {
  return getPlatformConfig(platform).origin;
}

export function getPlatformHomeUrl(platform: PlatformName): string {
  return getPlatformConfig(platform).homeUrl;
}

export function getPlatformCookieDomain(platform: PlatformName): string {
  return getPlatformConfig(platform).cookieDomain;
}

export function getPlatformAuthCookieNames(platform: PlatformName): readonly string[] {
  return getPlatformConfig(platform).authCookieNames;
}

export function getPlatformBrowserAuthCookieNames(platform: PlatformName): readonly string[] {
  const config = getPlatformConfig(platform);
  return config.browserAuthCookieNames ?? config.authCookieNames;
}

export function getPlatformBrowserReadyCookieNames(platform: PlatformName): readonly string[] {
  const config = getPlatformConfig(platform);
  return config.browserReadyCookieNames ?? getPlatformBrowserAuthCookieNames(platform);
}

export function getPlatformBrowserAuthStorageKeys(platform: PlatformName): readonly string[] {
  return getPlatformConfig(platform).browserAuthStorageKeys ?? [];
}

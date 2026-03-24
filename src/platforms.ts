export const PLATFORM_NAMES = ["instagram", "linkedin", "x", "youtube"] as const;

export type PlatformName = (typeof PLATFORM_NAMES)[number];

export interface PlatformConfig {
  displayName: string;
  origin: string;
  homeUrl: string;
  cookieDomain: string;
  authCookieNames: readonly string[];
}

export const PLATFORM_CONFIG: Record<PlatformName, PlatformConfig> = {
  instagram: {
    displayName: "Instagram",
    origin: "https://www.instagram.com",
    homeUrl: "https://www.instagram.com/",
    cookieDomain: "instagram.com",
    authCookieNames: ["sessionid", "csrftoken", "ds_user_id"],
  },
  linkedin: {
    displayName: "LinkedIn",
    origin: "https://www.linkedin.com",
    homeUrl: "https://www.linkedin.com/",
    cookieDomain: "linkedin.com",
    authCookieNames: ["li_at", "JSESSIONID"],
  },
  x: {
    displayName: "X",
    origin: "https://x.com",
    homeUrl: "https://x.com/",
    cookieDomain: "x.com",
    authCookieNames: ["auth_token", "ct0"],
  },
  youtube: {
    displayName: "YouTube",
    origin: "https://www.youtube.com",
    homeUrl: "https://www.youtube.com/",
    cookieDomain: "youtube.com",
    authCookieNames: ["SAPISID", "LOGIN_INFO", "__Secure-3PSID", "SSID"],
  },
};

export function isPlatform(value: string): value is PlatformName {
  return (PLATFORM_NAMES as readonly string[]).includes(value);
}

export function getPlatformConfig(platform: PlatformName): PlatformConfig {
  return PLATFORM_CONFIG[platform];
}

export function getPlatformDisplayName(platform: PlatformName): string {
  return getPlatformConfig(platform).displayName;
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

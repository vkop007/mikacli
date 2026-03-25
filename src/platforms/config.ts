export const PLATFORM_NAMES = [
  "cheat",
  "discordbot",
  "facebook",
  "github",
  "githubbot",
  "gitlab",
  "ip",
  "instagram",
  "linkedin",
  "linear",
  "notion",
  "qr",
  "slackbot",
  "telegrambot",
  "tiktok",
  "time",
  "weather",
  "websearch",
  "x",
  "youtube",
] as const;

export type PlatformName = (typeof PLATFORM_NAMES)[number];

export interface PlatformConfig {
  displayName: string;
  origin: string;
  homeUrl: string;
  cookieDomain: string;
  authCookieNames: readonly string[];
}

export const PLATFORM_CONFIG: Record<PlatformName, PlatformConfig> = {
  cheat: {
    displayName: "Cheat",
    origin: "https://cht.sh",
    homeUrl: "https://cht.sh/",
    cookieDomain: "cht.sh",
    authCookieNames: [],
  },
  discordbot: {
    displayName: "Discord Bot",
    origin: "https://discord.com",
    homeUrl: "https://discord.com/developers/applications",
    cookieDomain: "discord.com",
    authCookieNames: [],
  },
  facebook: {
    displayName: "Facebook",
    origin: "https://www.facebook.com",
    homeUrl: "https://www.facebook.com/",
    cookieDomain: "facebook.com",
    authCookieNames: ["c_user", "xs"],
  },
  github: {
    displayName: "GitHub",
    origin: "https://api.github.com",
    homeUrl: "https://github.com/",
    cookieDomain: "github.com",
    authCookieNames: [],
  },
  githubbot: {
    displayName: "GitHub Bot",
    origin: "https://api.github.com",
    homeUrl: "https://github.com/",
    cookieDomain: "github.com",
    authCookieNames: [],
  },
  gitlab: {
    displayName: "GitLab",
    origin: "https://gitlab.com",
    homeUrl: "https://gitlab.com/",
    cookieDomain: "gitlab.com",
    authCookieNames: [],
  },
  ip: {
    displayName: "IP",
    origin: "https://api64.ipify.org",
    homeUrl: "https://www.ipify.org/",
    cookieDomain: "ipify.org",
    authCookieNames: [],
  },
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
  linear: {
    displayName: "Linear",
    origin: "https://api.linear.app",
    homeUrl: "https://linear.app/",
    cookieDomain: "linear.app",
    authCookieNames: [],
  },
  notion: {
    displayName: "Notion",
    origin: "https://api.notion.com",
    homeUrl: "https://www.notion.so/",
    cookieDomain: "notion.so",
    authCookieNames: [],
  },
  qr: {
    displayName: "QR",
    origin: "https://qrenco.de",
    homeUrl: "https://qrenco.de/",
    cookieDomain: "qrenco.de",
    authCookieNames: [],
  },
  slackbot: {
    displayName: "Slack Bot",
    origin: "https://slack.com",
    homeUrl: "https://api.slack.com",
    cookieDomain: "slack.com",
    authCookieNames: [],
  },
  telegrambot: {
    displayName: "Telegram Bot",
    origin: "https://api.telegram.org",
    homeUrl: "https://core.telegram.org/bots/api",
    cookieDomain: "telegram.org",
    authCookieNames: [],
  },
  tiktok: {
    displayName: "TikTok",
    origin: "https://www.tiktok.com",
    homeUrl: "https://www.tiktok.com/",
    cookieDomain: "tiktok.com",
    authCookieNames: ["sid_tt"],
  },
  time: {
    displayName: "Time",
    origin: "https://worldtimeapi.org",
    homeUrl: "https://worldtimeapi.org/",
    cookieDomain: "worldtimeapi.org",
    authCookieNames: [],
  },
  weather: {
    displayName: "Weather",
    origin: "https://wttr.in",
    homeUrl: "https://wttr.in/",
    cookieDomain: "wttr.in",
    authCookieNames: [],
  },
  websearch: {
    displayName: "Web Search",
    origin: "https://html.duckduckgo.com",
    homeUrl: "https://duckduckgo.com/",
    cookieDomain: "duckduckgo.com",
    authCookieNames: [],
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

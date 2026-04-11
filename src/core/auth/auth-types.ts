import type { Platform, SessionSource, SessionStatus, SessionUser } from "../../types.js";

export const AUTH_STRATEGY_KINDS = ["cookies", "oauth2", "apiKey", "botToken", "session", "none"] as const;

export type AuthStrategyKind = (typeof AUTH_STRATEGY_KINDS)[number];

export interface CookieConnectionAuth {
  kind: "cookies";
  source?: SessionSource["kind"];
}

export interface OAuth2ConnectionAuth {
  kind: "oauth2";
  provider?: string;
  scopes?: string[];
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: string;
  tokenType?: string;
}

export interface ApiKeyConnectionAuth {
  kind: "apiKey";
  provider?: string;
  token: string;
}

export interface BotTokenConnectionAuth {
  kind: "botToken";
  provider?: string;
  token: string;
}

export interface SessionConnectionAuth {
  kind: "session";
  provider?: string;
}

export interface NoAuthConnectionAuth {
  kind: "none";
}

export type ConnectionAuth =
  | CookieConnectionAuth
  | OAuth2ConnectionAuth
  | ApiKeyConnectionAuth
  | BotTokenConnectionAuth
  | SessionConnectionAuth
  | NoAuthConnectionAuth;

export interface ConnectionRecord {
  version: 1;
  platform: Platform;
  account: string;
  createdAt: string;
  updatedAt: string;
  auth: ConnectionAuth;
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

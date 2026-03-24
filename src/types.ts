import type { SerializedCookieJar } from "tough-cookie";

export type Platform = "instagram" | "linkedin" | "x" | "youtube";

export type SessionState = "active" | "expired" | "unknown";

export interface SessionSource {
  kind: "cookies_txt" | "cookie_string" | "cookie_json";
  importedAt: string;
  description: string;
  path?: string;
}

export interface SessionUser {
  id?: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
}

export interface SessionStatus {
  state: SessionState;
  message?: string;
  lastValidatedAt?: string;
  lastErrorCode?: string;
}

export interface PlatformSession {
  version: 1;
  platform: Platform;
  account: string;
  createdAt: string;
  updatedAt: string;
  source: SessionSource;
  user?: SessionUser;
  status: SessionStatus;
  metadata?: Record<string, unknown>;
  cookieJar: SerializedCookieJar;
}

export interface LoginInput {
  account?: string;
  cookieFile?: string;
  cookieString?: string;
  cookieJson?: string;
}

export interface PostMediaInput {
  account?: string;
  mediaPath: string;
  caption?: string;
}

export interface TextPostInput {
  account?: string;
  text: string;
  imagePath?: string;
}

export interface LikeInput {
  account?: string;
  target: string;
}

export interface CommentInput {
  account?: string;
  target: string;
  text: string;
}

export interface CommandContext {
  json: boolean;
  verbose: boolean;
}

export interface AdapterActionResult {
  ok: true;
  platform: Platform;
  account: string;
  action: string;
  message: string;
  id?: string;
  url?: string;
  user?: SessionUser;
  sessionPath?: string;
  data?: Record<string, unknown>;
}

export interface AdapterStatusResult {
  platform: Platform;
  account: string;
  sessionPath: string;
  connected: boolean;
  status: SessionState;
  message?: string;
  user?: SessionUser;
  lastValidatedAt?: string;
}

export interface PlatformAdapter {
  readonly platform: Platform;
  readonly displayName: string;
  login(input: LoginInput): Promise<AdapterActionResult>;
  getStatus(account?: string): Promise<AdapterStatusResult>;
  postMedia(input: PostMediaInput): Promise<AdapterActionResult>;
  postText(input: TextPostInput): Promise<AdapterActionResult>;
  like(input: LikeInput): Promise<AdapterActionResult>;
  comment(input: CommentInput): Promise<AdapterActionResult>;
}

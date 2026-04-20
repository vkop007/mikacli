import { CookieJar } from "tough-cookie";

import { MikaCliError } from "../../../errors.js";
import { parseBlueskyPostTarget, parseBlueskyProfileTarget } from "../../../utils/targets.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";
import { normalizeSocialLimit } from "../shared/options.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../../../types.js";

const BSKY_PUBLIC_XRPC = "https://public.api.bsky.app/xrpc";
const BSKY_DEFAULT_SERVICE = "https://bsky.social";
const BSKY_APP_ORIGIN = "https://bsky.app";
const BSKY_USER_AGENT = "MikaCLI/1.0 (+https://github.com/vkop007/Pluse)";

interface BlueskyActorSearchResponse {
  actors?: Array<Record<string, unknown>>;
}

interface BlueskyProfileResponse extends Record<string, unknown> {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

interface BlueskyAuthorFeedResponse {
  feed?: Array<Record<string, unknown>>;
}

interface BlueskyThreadResponse {
  thread?: Record<string, unknown>;
}

interface BlueskySessionResponse extends Record<string, unknown> {
  did?: string;
  handle?: string;
  email?: string;
  accessJwt?: string;
  refreshJwt?: string;
}

interface BlueskyCreateRecordResponse extends Record<string, unknown> {
  uri?: string;
  cid?: string;
}

interface BlueskyResolvedSubject {
  uri: string;
  cid: string;
  rootUri: string;
  rootCid: string;
  url?: string;
}

export class BlueskyAdapter extends BasePlatformAdapter {
  readonly platform = "bluesky" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    throw new MikaCliError(
      "INVALID_LOGIN_INPUT",
      "Bluesky login uses app-password auth. Run `mikacli social bluesky login --handle <handle> --app-password <password>`.",
      {
        details: {
          supportedFlags: ["--handle", "--app-password", "--service", "--account"],
          received: {
            account: input.account,
            token: Boolean(input.token),
            browser: Boolean(input.browser),
            cookieFile: Boolean(input.cookieFile),
            cookieString: Boolean(input.cookieString),
            cookieJson: Boolean(input.cookieJson),
          },
        },
      },
    );
  }

  async loginWithCredentials(input: {
    handle: string;
    appPassword: string;
    account?: string;
    service?: string;
  }): Promise<AdapterActionResult> {
    const handle = normalizeRequiredText(input.handle, "BLUESKY_HANDLE_REQUIRED", "Provide a Bluesky handle to log in.");
    const appPassword = normalizeRequiredText(
      input.appPassword,
      "BLUESKY_APP_PASSWORD_REQUIRED",
      "Provide a Bluesky app password to log in.",
    );
    const service = normalizeBlueskyServiceUrl(input.service);
    const created = await this.fetchServiceJson<BlueskySessionResponse>("com.atproto.server.createSession", {
      service,
      method: "POST",
      body: {
        identifier: handle,
        password: appPassword,
      },
    });

    const user = mapSessionUser(created);
    const account = input.account ?? user.username ?? user.id ?? handle;
    const metadata = mergeMetadata(undefined, {
      service,
      accessJwt: stringOrUndefined(created.accessJwt),
      refreshJwt: stringOrUndefined(created.refreshJwt),
      did: user.id,
      handle: user.username,
      email: stringOrUndefined(created.email),
    });
    const status = buildActiveStatus("Bluesky app-password session is active.");
    const sessionPath = await this.saveSession({
      account,
      source: {
        kind: "cookie_json",
        importedAt: new Date().toISOString(),
        description: `Created from Bluesky app-password login for ${user.username ?? handle}`,
      },
      user,
      status,
      metadata,
      jar: new CookieJar(),
    });

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message: `Saved Bluesky session for ${user.username ?? account}.`,
      user,
      sessionPath,
      data: {
        status: status.state,
        service,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const nextSession = await this.ensureActiveSession(session);
    return this.buildStatusResult({
      account: nextSession.account,
      sessionPath: path,
      status: nextSession.status,
      user: nextSession.user,
    });
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: `Bluesky session is ${status.status}.`,
      user: status.user,
      sessionPath: status.sessionPath,
      data: {
        connected: status.connected,
        status: status.status,
        details: status.message,
        lastValidatedAt: status.lastValidatedAt,
      },
    };
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const context = await this.createAuthorizedContext(account);
    const actor = context.session.user?.id ?? context.session.user?.username ?? readMetadataString(context.session.metadata, "did");
    if (!actor) {
      throw new MikaCliError("BLUESKY_SESSION_INVALID", "Saved Bluesky session is missing the account DID/handle.", {
        details: {
          account: context.session.account,
        },
      });
    }

    const profile = await this.fetchServiceJson<BlueskyProfileResponse>("app.bsky.actor.getProfile", {
      service: context.service,
      authToken: context.accessJwt,
      query: {
        actor,
      },
    });
    const mapped = mapProfile(profile);

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "me",
      message: `Loaded Bluesky profile ${mapped.username}.`,
      id: mapped.did as string | undefined,
      url: mapped.url as string | undefined,
      user: {
        id: mapped.did as string | undefined,
        username: mapped.username as string | undefined,
        displayName: mapped.displayName as string | undefined,
        profileUrl: mapped.url as string | undefined,
      },
      sessionPath: context.path,
      data: {
        profile: mapped,
      },
    };
  }

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = normalizeRequiredText(input.query, "BLUESKY_QUERY_REQUIRED", "Provide a Bluesky query to search.");
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const response = await this.fetchPublicJson<BlueskyActorSearchResponse>("app.bsky.actor.searchActors", {
      q: query,
      limit: String(limit),
    });
    const items = (response.actors ?? []).map((actor) => mapActor(actor)).filter(Boolean) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} Bluesky profile${items.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        items,
      },
    };
  }

  async profileInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = parseBlueskyProfileTarget(input.target);
    const profile = await this.fetchPublicJson<BlueskyProfileResponse>("app.bsky.actor.getProfile", {
      actor: resolved.actor,
    });
    const mapped = mapProfile(profile);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "profile",
      message: `Loaded Bluesky profile ${mapped.username}.`,
      id: mapped.did as string | undefined,
      url: mapped.url as string | undefined,
      user: {
        id: mapped.did as string | undefined,
        username: mapped.username as string | undefined,
        displayName: mapped.displayName as string | undefined,
        profileUrl: mapped.url as string | undefined,
      },
      data: {
        profile: mapped,
      },
    };
  }

  async posts(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parseBlueskyProfileTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const response = await this.fetchPublicJson<BlueskyAuthorFeedResponse>("app.bsky.feed.getAuthorFeed", {
      actor: resolved.actor,
      limit: String(limit),
    });
    const items = (response.feed ?? [])
      .map((entry) => mapPost(asRecord(entry)?.post))
      .filter(Boolean) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "posts",
      message: `Loaded ${items.length} Bluesky post${items.length === 1 ? "" : "s"}.`,
      data: {
        target: resolved.actor,
        items,
      },
    };
  }

  async threadInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const resolved = await this.resolveThreadTarget(input.target);
    const response = await this.fetchPublicJson<BlueskyThreadResponse>("app.bsky.feed.getPostThread", {
      uri: resolved.uri,
      depth: "2",
    });
    const thread = asRecord(response.thread);
    const root = mapPost(thread?.post);
    if (!root) {
      throw new MikaCliError("BLUESKY_THREAD_NOT_FOUND", "Bluesky could not load the requested thread.", {
        details: {
          target: input.target,
          uri: resolved.uri,
        },
      });
    }

    const replies = asArray(thread?.replies)
      .map((reply) => mapPost(asRecord(reply)?.post))
      .filter(Boolean)
      .slice(0, limit) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "thread",
      message: `Loaded Bluesky thread ${String(root.id ?? resolved.uri)}.`,
      id: String(root.id ?? resolved.uri),
      url: String(root.url ?? resolved.url ?? ""),
      data: {
        thread: root,
        replies,
      },
    };
  }

  async postMedia(): Promise<AdapterActionResult> {
    throw new MikaCliError(
      "UNSUPPORTED_ACTION",
      "Bluesky media uploads are not wired yet. Use `mikacli social bluesky post <text>` for text posts today.",
    );
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    const text = normalizeRequiredText(input.text, "BLUESKY_POST_TEXT_REQUIRED", "Provide text for the Bluesky post.");
    const context = await this.createAuthorizedContext(input.account);
    const repo = context.session.user?.id ?? readMetadataString(context.session.metadata, "did");
    if (!repo) {
      throw new MikaCliError("BLUESKY_SESSION_INVALID", "Saved Bluesky session is missing the account DID.", {
        details: { account: context.session.account },
      });
    }

    const created = await this.fetchServiceJson<BlueskyCreateRecordResponse>("com.atproto.repo.createRecord", {
      service: context.service,
      authToken: context.accessJwt,
      method: "POST",
      body: {
        repo,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          createdAt: new Date().toISOString(),
        },
      },
    });
    const postUrl = buildBlueskyPostUrlFromUri(created.uri, context.session.user?.username);

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "post",
      message: `Bluesky post created for ${context.session.account}.`,
      id: extractRecordKey(created.uri),
      url: postUrl,
      user: context.session.user,
      sessionPath: context.path,
      data: {
        text,
        uri: created.uri,
        cid: created.cid,
      },
    };
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const context = await this.createAuthorizedContext(input.account);
    const repo = context.session.user?.id ?? readMetadataString(context.session.metadata, "did");
    if (!repo) {
      throw new MikaCliError("BLUESKY_SESSION_INVALID", "Saved Bluesky session is missing the account DID.", {
        details: { account: context.session.account },
      });
    }

    const subject = await this.resolvePostSubject(input.target);
    const created = await this.fetchServiceJson<BlueskyCreateRecordResponse>("com.atproto.repo.createRecord", {
      service: context.service,
      authToken: context.accessJwt,
      method: "POST",
      body: {
        repo,
        collection: "app.bsky.feed.like",
        record: {
          $type: "app.bsky.feed.like",
          subject: {
            uri: subject.uri,
            cid: subject.cid,
          },
          createdAt: new Date().toISOString(),
        },
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "like",
      message: `Bluesky post liked for ${context.session.account}.`,
      id: extractRecordKey(created.uri),
      url: subject.url,
      user: context.session.user,
      sessionPath: context.path,
      data: {
        target: subject.uri,
        uri: created.uri,
        cid: created.cid,
      },
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const text = normalizeRequiredText(input.text, "BLUESKY_COMMENT_TEXT_REQUIRED", "Provide text for the Bluesky reply.");
    const context = await this.createAuthorizedContext(input.account);
    const repo = context.session.user?.id ?? readMetadataString(context.session.metadata, "did");
    if (!repo) {
      throw new MikaCliError("BLUESKY_SESSION_INVALID", "Saved Bluesky session is missing the account DID.", {
        details: { account: context.session.account },
      });
    }

    const subject = await this.resolvePostSubject(input.target);
    const created = await this.fetchServiceJson<BlueskyCreateRecordResponse>("com.atproto.repo.createRecord", {
      service: context.service,
      authToken: context.accessJwt,
      method: "POST",
      body: {
        repo,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          createdAt: new Date().toISOString(),
          reply: {
            root: {
              uri: subject.rootUri,
              cid: subject.rootCid,
            },
            parent: {
              uri: subject.uri,
              cid: subject.cid,
            },
          },
        },
      },
    });
    const postUrl = buildBlueskyPostUrlFromUri(created.uri, context.session.user?.username);

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "comment",
      message: `Bluesky reply posted for ${context.session.account}.`,
      id: extractRecordKey(created.uri),
      url: postUrl ?? subject.url,
      user: context.session.user,
      sessionPath: context.path,
      data: {
        target: subject.uri,
        text,
        uri: created.uri,
        cid: created.cid,
      },
    };
  }

  private async createAuthorizedContext(account?: string): Promise<{
    session: PlatformSession;
    path: string;
    service: string;
    accessJwt: string;
  }> {
    const { session, path } = await this.loadSession(account);
    const nextSession = await this.ensureActiveSession(session);
    const accessJwt = readMetadataString(nextSession.metadata, "accessJwt");
    if (!accessJwt) {
      throw new MikaCliError("SESSION_EXPIRED", "Saved Bluesky session is missing an access token.", {
        details: {
          account: nextSession.account,
          sessionPath: path,
        },
      });
    }

    return {
      session: nextSession,
      path,
      service: this.getSessionService(nextSession),
      accessJwt,
    };
  }

  private async ensureActiveSession(session: PlatformSession): Promise<PlatformSession> {
    const service = this.getSessionService(session);
    const accessJwt = readMetadataString(session.metadata, "accessJwt");
    const refreshJwt = readMetadataString(session.metadata, "refreshJwt");
    if (!accessJwt) {
      const expired = await this.persistExistingSession(session, {
        status: buildExpiredStatus("Saved Bluesky session is missing an access token.", "SESSION_EXPIRED"),
      });
      throw new MikaCliError("SESSION_EXPIRED", "Saved Bluesky session is missing an access token.", {
        details: {
          account: expired.account,
        },
      });
    }

    try {
      const info = await this.fetchServiceJson<BlueskySessionResponse>("com.atproto.server.getSession", {
        service,
        authToken: accessJwt,
      });
      return this.persistExistingSession(session, {
        user: mapSessionUser(info),
        status: buildActiveStatus("Bluesky session is active."),
        metadata: mergeMetadata(session.metadata, {
          service,
          accessJwt,
          refreshJwt,
          did: stringOrUndefined(info.did) ?? readMetadataString(session.metadata, "did"),
          handle: stringOrUndefined(info.handle) ?? readMetadataString(session.metadata, "handle"),
          email: stringOrUndefined(info.email) ?? readMetadataString(session.metadata, "email"),
        }),
      });
    } catch (error) {
      if (!isUnauthorizedBlueskyError(error) || !refreshJwt) {
        const expired = await this.persistExistingSession(session, {
          status: buildExpiredStatus("Saved Bluesky session is no longer valid.", extractErrorCode(error)),
        });
        throw new MikaCliError("SESSION_EXPIRED", "Bluesky session has expired. Re-login with an app password.", {
          details: {
            account: expired.account,
            reason: extractErrorCode(error),
          },
          cause: error,
        });
      }
    }

    const refreshed = await this.fetchServiceJson<BlueskySessionResponse>("com.atproto.server.refreshSession", {
      service,
      authToken: refreshJwt,
      method: "POST",
    });
    return this.persistExistingSession(session, {
      user: mapSessionUser(refreshed),
      status: buildActiveStatus("Bluesky session refreshed."),
      metadata: mergeMetadata(session.metadata, {
        service,
        accessJwt: stringOrUndefined(refreshed.accessJwt),
        refreshJwt: stringOrUndefined(refreshed.refreshJwt) ?? refreshJwt,
        did: stringOrUndefined(refreshed.did) ?? readMetadataString(session.metadata, "did"),
        handle: stringOrUndefined(refreshed.handle) ?? readMetadataString(session.metadata, "handle"),
        email: stringOrUndefined(refreshed.email) ?? readMetadataString(session.metadata, "email"),
      }),
    });
  }

  private getSessionService(session: PlatformSession): string {
    return normalizeBlueskyServiceUrl(readMetadataString(session.metadata, "service"));
  }

  private async resolveThreadTarget(target: string): Promise<{ uri: string; url?: string }> {
    const parsed = parseBlueskyPostTarget(target);
    if (parsed.uri) {
      return {
        uri: parsed.uri,
      };
    }

    if (!parsed.handle || !parsed.rkey) {
      throw new MikaCliError("BLUESKY_THREAD_TARGET_INVALID", "Expected a Bluesky post URL or at:// URI.", {
        details: { target },
      });
    }

    const profile = await this.fetchPublicJson<BlueskyProfileResponse>("app.bsky.actor.getProfile", {
      actor: parsed.handle,
    });
    if (!profile.did) {
      throw new MikaCliError("BLUESKY_PROFILE_NOT_FOUND", `Bluesky could not resolve ${parsed.handle}.`, {
        details: { target },
      });
    }

    return {
      uri: `at://${profile.did}/app.bsky.feed.post/${parsed.rkey}`,
      url: parsed.url,
    };
  }

  private async resolvePostSubject(target: string): Promise<BlueskyResolvedSubject> {
    const resolved = await this.resolveThreadTarget(target);
    const response = await this.fetchPublicJson<BlueskyThreadResponse>("app.bsky.feed.getPostThread", {
      uri: resolved.uri,
      depth: "0",
    });
    const thread = asRecord(response.thread);
    const post = asRecord(thread?.post);
    const record = asRecord(post?.record);
    const reply = asRecord(record?.reply);
    const root = asRecord(reply?.root);

    const uri = stringOrUndefined(post?.uri) ?? resolved.uri;
    const cid = stringOrUndefined(post?.cid);
    if (!cid) {
      throw new MikaCliError("BLUESKY_THREAD_NOT_FOUND", "Bluesky did not return the post CID needed for this action.", {
        details: {
          target,
          uri,
        },
      });
    }

    const authorHandle = stringOrUndefined(asRecord(post?.author)?.handle);
    const rootUri = stringOrUndefined(root?.uri) ?? uri;
    const rootCid = stringOrUndefined(root?.cid) ?? cid;

    return {
      uri,
      cid,
      rootUri,
      rootCid,
      url: resolved.url ?? buildBlueskyPostUrlFromUri(uri, authorHandle),
    };
  }

  private async fetchPublicJson<T>(method: string, query: Record<string, string>): Promise<T> {
    const url = new URL(`${BSKY_PUBLIC_XRPC}/${method}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        "user-agent": BSKY_USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
      },
    });

    return this.parseBlueskyJsonResponse<T>(response, method);
  }

  private async fetchServiceJson<T>(
    method: string,
    input: {
      service?: string;
      authToken?: string;
      method?: "GET" | "POST";
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    const service = normalizeBlueskyServiceUrl(input.service);
    const url = new URL(`/xrpc/${method}`, service);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const requestMethod = input.method ?? (input.body ? "POST" : "GET");
    const headers: Record<string, string> = {
      "user-agent": BSKY_USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    };
    if (input.authToken) {
      headers.authorization = `Bearer ${input.authToken}`;
    }
    if (input.body) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(url, {
      method: requestMethod,
      headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
    });

    return this.parseBlueskyJsonResponse<T>(response, method);
  }

  private async parseBlueskyJsonResponse<T>(response: Response, method: string): Promise<T> {
    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("BLUESKY_REQUEST_FAILED", `Bluesky rejected the ${method} request.`, {
        details: {
          method,
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 500),
        },
      });
    }

    return JSON.parse(text) as T;
  }
}

function buildActiveStatus(message: string): SessionStatus {
  return {
    state: "active",
    message,
    lastValidatedAt: new Date().toISOString(),
  };
}

function buildExpiredStatus(message: string, errorCode?: string): SessionStatus {
  return {
    state: "expired",
    message,
    lastValidatedAt: new Date().toISOString(),
    ...(errorCode ? { lastErrorCode: errorCode } : {}),
  };
}

function mergeMetadata(
  current: Record<string, unknown> | undefined,
  next: Record<string, unknown | undefined>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "undefined") {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function mapSessionUser(input: BlueskySessionResponse): SessionUser {
  const handle = stringOrUndefined(input.handle);
  const did = stringOrUndefined(input.did);
  return {
    id: did,
    username: handle,
    displayName: handle,
    profileUrl: handle ? `${BSKY_APP_ORIGIN}/profile/${handle}` : undefined,
  };
}

function mapActor(actor: Record<string, unknown>): Record<string, unknown> | undefined {
  const handle = stringOrUndefined(actor.handle);
  if (!handle) {
    return undefined;
  }

  const displayName = stringOrUndefined(actor.displayName) ?? handle;
  return {
    id: stringOrUndefined(actor.did),
    title: displayName,
    username: handle,
    did: stringOrUndefined(actor.did),
    summary: stringOrUndefined(actor.description),
    followers: numberOrUndefined(actor.followersCount),
    url: `${BSKY_APP_ORIGIN}/profile/${handle}`,
  };
}

function mapProfile(profile: BlueskyProfileResponse): Record<string, unknown> {
  const handle = stringOrUndefined(profile.handle) ?? "unknown";
  return {
    displayName: stringOrUndefined(profile.displayName) ?? handle,
    username: handle,
    did: stringOrUndefined(profile.did),
    bio: stringOrUndefined(profile.description),
    followers: numberOrUndefined(profile.followersCount),
    following: numberOrUndefined(profile.followsCount),
    posts: numberOrUndefined(profile.postsCount),
    url: `${BSKY_APP_ORIGIN}/profile/${handle}`,
  };
}

function mapPost(post: unknown): Record<string, unknown> | undefined {
  const typedPost = asRecord(post);
  if (!typedPost) {
    return undefined;
  }

  const author = asRecord(typedPost.author);
  const record = asRecord(typedPost.record);
  const handle = stringOrUndefined(author?.handle);
  const uri = stringOrUndefined(typedPost.uri);
  const rkey = extractRecordKey(uri);
  const url = handle && rkey ? `${BSKY_APP_ORIGIN}/profile/${handle}/post/${rkey}` : undefined;
  const text = stringOrUndefined(record?.text);

  return {
    id: rkey ?? uri,
    title: text ? text.slice(0, 120) : handle ? `${handle} post` : undefined,
    text,
    username: handle,
    publishedAt: stringOrUndefined(typedPost.indexedAt) ?? stringOrUndefined(record?.createdAt),
    metrics: [
      ["likes", numberOrUndefined(typedPost.likeCount)],
      ["reposts", numberOrUndefined(typedPost.repostCount)],
      ["replies", numberOrUndefined(typedPost.replyCount)],
      ["quotes", numberOrUndefined(typedPost.quoteCount)],
    ]
      .filter((entry) => typeof entry[1] === "number")
      .map(([label, value]) => `${label}:${value}`),
    url,
  };
}

function normalizeBlueskyServiceUrl(service?: string): string {
  const candidate = (service ?? BSKY_DEFAULT_SERVICE).trim();
  if (!candidate) {
    return BSKY_DEFAULT_SERVICE;
  }

  const normalized = candidate.startsWith("http://") || candidate.startsWith("https://") ? candidate : `https://${candidate}`;
  return normalized.replace(/\/+$/u, "");
}

function buildBlueskyPostUrlFromUri(uri: string | undefined, handle?: string): string | undefined {
  if (!uri || !handle) {
    return undefined;
  }

  const rkey = extractRecordKey(uri);
  return rkey ? `${BSKY_APP_ORIGIN}/profile/${handle}/post/${rkey}` : undefined;
}

function extractRecordKey(uri: string | undefined): string | undefined {
  if (typeof uri !== "string" || uri.length === 0) {
    return undefined;
  }

  return uri.split("/").at(-1) || undefined;
}

function normalizeRequiredText(value: string | undefined, code: string, message: string): string {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    throw new MikaCliError(code, message);
  }

  return normalized;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  return typeof metadata?.[key] === "string" ? (metadata[key] as string) : undefined;
}

function isUnauthorizedBlueskyError(error: unknown): boolean {
  return extractErrorStatus(error) === 401;
}

function extractErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof MikaCliError)) {
    return undefined;
  }

  return typeof error.details?.status === "number" ? (error.details.status as number) : undefined;
}

function extractErrorCode(error: unknown): string | undefined {
  if (!(error instanceof MikaCliError)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

import { AutoCliError } from "../../../errors.js";
import { parseTwitchProfileTarget } from "../../../utils/targets.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";
import { normalizeSocialLimit } from "../shared/options.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../../../types.js";
import type { CookieJar } from "tough-cookie";

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_HOME_URL = "https://www.twitch.tv/";
const TWITCH_VALIDATE_ENDPOINT = "https://id.twitch.tv/oauth2/validate";
const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

const TWITCH_OPERATIONS = {
  userMenuCurrentUser: {
    operationName: "UserMenuCurrentUser",
    sha256Hash: "3cff634f43c5c78830907a662b315b1847cfc0dce32e6a9752e7f5d70b37f8c0",
  },
  channelShell: {
    operationName: "ChannelShell",
    sha256Hash: "fea4573a7bf2644f5b3f2cbbdcbee0d17312e48d2e55f080589d053aad353f11",
  },
  homeOfflineCarousel: {
    operationName: "HomeOfflineCarousel",
    sha256Hash: "0409584bcabf718836bf330c29d0ac9d9a58f9674f7684bcbfce1a3e8dcf93b2",
  },
  channelAvatar: {
    operationName: "ChannelAvatar",
    sha256Hash: "db0e7b54c5e75fcf7874cafca2dacde646344cbbd1a80a2488a7953176c87a68",
  },
  searchResults: {
    operationName: "SearchResultsPage_SearchResults",
    sha256Hash: "c1fe88431e82c9fc449f6478f9864ae095614baf1a0fac686d7ad8e23c6aea7e",
  },
  channelVideoShelves: {
    operationName: "ChannelVideoShelvesQuery",
    sha256Hash: "280f582866d0914749c1666da7adfcdb42739182b060ef4050641aa9324da19b",
  },
  clipsCardsUser: {
    operationName: "ClipsCards__User",
    sha256Hash: "1cd671bfa12cec480499c087319f26d21925e9695d1f80225aae6a4354f23088",
  },
  useLive: {
    operationName: "UseLive",
    sha256Hash: "639d5f11bfb8bf3053b424d9ef650d04c4ebb7d94711d644afb08fe9a0fad5d9",
  },
} as const;

type TwitchClipPeriod = "all-time" | "last-week" | "last-day";

interface TwitchValidateResponse {
  client_id?: string;
  login?: string;
  user_id?: string;
  scopes?: string[];
  expires_in?: number;
}

interface TwitchProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

interface TwitchGraphQlResult {
  data?: Record<string, unknown>;
  errors?: Array<{ message?: string }>;
}

interface TwitchOperationInput {
  operationName: string;
  sha256Hash: string;
  variables: Record<string, unknown>;
}

interface TwitchAuthContext {
  session: PlatformSession;
  path: string;
  accessToken: string;
  clientId: string;
  login: string;
  userId?: string;
}

export class TwitchAdapter extends BasePlatformAdapter {
  readonly platform = "twitch" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const probe = await this.probeImportedSession(imported.jar);
    const account = input.account ?? probe.user?.username ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Twitch session has expired.", {
        details: {
          platform: this.platform,
          account,
          sessionPath,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message: `Saved Twitch session for ${account}.`,
      user: probe.user,
      sessionPath,
      data: {
        status: probe.status.state,
        login: {
          authType: "cookies",
          status: probe.status.state,
          validation: probe.status.state === "active" ? "verified" : "partial",
          source: imported.source.kind,
          reused: imported.source.description.includes("existing session"),
          recommendedNextCommand: `autocli social twitch me${account === "default" ? "" : ` --account ${account}`}`,
        },
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const probe = await this.probeStoredSession(session);
    await this.persistExistingSession(session, {
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
    });

    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: probe.status,
      user: probe.user,
    });
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: `Twitch session is ${status.status}.`,
      user: status.user,
      sessionPath: status.sessionPath,
      data: {
        connected: status.connected,
        status: status.status,
        login: status.user?.username,
        details: status.message,
        lastValidatedAt: status.lastValidatedAt,
      },
    };
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const context = await this.loadAuthorizedContext(account);
    const results = await this.gqlBatch(context, [
      operation(TWITCH_OPERATIONS.userMenuCurrentUser, {}),
      operation(TWITCH_OPERATIONS.homeOfflineCarousel, {
        channelLogin: context.login,
        includeTrailerUpsell: true,
        trailerUpsellVideoID: "",
      }),
      operation(TWITCH_OPERATIONS.channelAvatar, {
        channelLogin: context.login,
      }),
    ]);
    const currentUserResult = results[0]!;
    const homeResult = results[1]!;
    const avatarResult = results[2]!;

    const currentUser = readPath(currentUserResult.data, "currentUser");
    const homeUser = readPath(homeResult.data, "user");
    const avatarUser = readPath(avatarResult.data, "user");
    const profile = mapTwitchProfile({
      login: context.login,
      homeUser,
      avatarUser,
      currentUser,
    });

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "me",
      message: `Loaded Twitch profile ${profile.username}.`,
      id: readString(profile.id),
      url: readString(profile.url),
      user: {
        id: readString(profile.id),
        username: readString(profile.username),
        displayName: readString(profile.displayName),
        profileUrl: readString(profile.url),
      },
      data: {
        entity: profile,
        profile,
      },
    };
  }

  async search(input: { account?: string; query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("TWITCH_QUERY_REQUIRED", "Provide a Twitch query to search.");
    }

    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const context = await this.loadAuthorizedContext(input.account);
    const results = await this.gqlBatch(context, [
      operation(TWITCH_OPERATIONS.searchResults, {
        platform: "web",
        query,
        options: {
          targets: null,
          shouldSkipDiscoveryControl: false,
        },
        requestID: `autocli-${Date.now()}`,
      }),
    ]);
    const result = results[0]!;

    const items = readArray(readPath(result.data, "searchFor", "channels", "edges"))
      .map((edge) => readPath(edge, "item"))
      .map((item) => mapSearchItem(item))
      .filter(Boolean)
      .slice(0, limit) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "search",
      message: `Loaded ${items.length} Twitch channel${items.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        items,
        meta: {
          count: items.length,
          listKey: "items",
        },
      },
    };
  }

  async channelInfo(input: { account?: string; target: string }): Promise<AdapterActionResult> {
    const resolved = parseTwitchProfileTarget(input.target);
    const context = await this.loadAuthorizedContext(input.account);
    const results = await this.gqlBatch(context, [
      operation(TWITCH_OPERATIONS.channelShell, {
        login: resolved.username,
      }),
      operation(TWITCH_OPERATIONS.homeOfflineCarousel, {
        channelLogin: resolved.username,
        includeTrailerUpsell: false,
        trailerUpsellVideoID: "",
      }),
      operation(TWITCH_OPERATIONS.channelAvatar, {
        channelLogin: resolved.username,
      }),
      operation(TWITCH_OPERATIONS.searchResults, {
        platform: "web",
        query: resolved.username,
        options: {
          targets: null,
          shouldSkipDiscoveryControl: false,
        },
        requestID: `autocli-${resolved.username}`,
      }),
    ]);
    const shellResult = results[0]!;
    const homeResult = results[1]!;
    const avatarResult = results[2]!;
    const searchResult = results[3]!;

    const shellUser = readPath(shellResult.data, "userOrError");
    const homeUser = readPath(homeResult.data, "user");
    const avatarUser = readPath(avatarResult.data, "user");
    if (!shellUser && !homeUser) {
      throw new AutoCliError("TWITCH_CHANNEL_NOT_FOUND", `Twitch could not find channel ${resolved.username}.`, {
        details: {
          target: input.target,
          username: resolved.username,
        },
      });
    }

    const searchItem = findExactSearchItem(searchResult.data, resolved.username);
    const profile = mapTwitchProfile({
      login: resolved.username,
      shellUser,
      homeUser,
      avatarUser,
      searchItem,
    });

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "channel",
      message: `Loaded Twitch channel ${profile.username}.`,
      id: readString(profile.id),
      url: readString(profile.url),
      data: {
        entity: profile,
        profile,
      },
    };
  }

  async streamInfo(input: { account?: string; target: string }): Promise<AdapterActionResult> {
    const resolved = parseTwitchProfileTarget(input.target);
    const context = await this.loadAuthorizedContext(input.account);
    const results = await this.gqlBatch(context, [
      operation(TWITCH_OPERATIONS.channelShell, {
        login: resolved.username,
      }),
      operation(TWITCH_OPERATIONS.useLive, {
        channelLogin: resolved.username,
      }),
      operation(TWITCH_OPERATIONS.searchResults, {
        platform: "web",
        query: resolved.username,
        options: {
          targets: null,
          shouldSkipDiscoveryControl: false,
        },
        requestID: `autocli-stream-${resolved.username}`,
      }),
    ]);
    const shellResult = results[0]!;
    const liveResult = results[1]!;
    const searchResult = results[2]!;

    const shellUser = readPath(shellResult.data, "userOrError");
    if (!shellUser) {
      throw new AutoCliError("TWITCH_CHANNEL_NOT_FOUND", `Twitch could not find channel ${resolved.username}.`, {
        details: {
          target: input.target,
          username: resolved.username,
        },
      });
    }

    const liveUser = readPath(liveResult.data, "user");
    const searchItem = findExactSearchItem(searchResult.data, resolved.username);
    const stream = mapStreamEntity(shellUser, liveUser, searchItem);

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "stream",
      message: stream.live ? `Loaded live status for ${stream.username}.` : `${stream.username} is currently offline.`,
      id: readString(stream.id),
      url: readString(stream.url),
      data: {
        entity: stream,
        stream,
      },
    };
  }

  async videos(input: { account?: string; target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = parseTwitchProfileTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const context = await this.loadAuthorizedContext(input.account);
    const results = await this.gqlBatch(context, [
      operation(TWITCH_OPERATIONS.channelVideoShelves, {
        includePreviewBlur: false,
        channelLogin: resolved.username,
        first: Math.max(limit, 5),
      }),
    ]);
    const result = results[0]!;

    const items = readArray(readPath(result.data, "user", "videoShelves", "edges"))
      .flatMap((edge) => {
        const shelf = asRecord(readPath(edge, "node"));
        if (!shelf) {
          return [];
        }

        if (readString(shelf.type) === "TOP_CLIPS") {
          return [];
        }

        return readArray(shelf.items).map((item) => mapVideoItem(item, shelf));
      })
      .filter(Boolean)
      .slice(0, limit) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "videos",
      message: `Loaded ${items.length} Twitch video${items.length === 1 ? "" : "s"} for ${resolved.username}.`,
      data: {
        target: resolved.username,
        items,
        meta: {
          count: items.length,
          listKey: "items",
        },
      },
    };
  }

  async clips(input: { account?: string; target: string; limit?: number; period?: TwitchClipPeriod }): Promise<AdapterActionResult> {
    const resolved = parseTwitchProfileTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const context = await this.loadAuthorizedContext(input.account);
    const results = await this.gqlBatch(context, [
      operation(TWITCH_OPERATIONS.clipsCardsUser, {
        login: resolved.username,
        limit,
        criteria: {
          filter: toClipFilter(input.period),
        },
        cursor: null,
      }),
    ]);
    const result = results[0]!;

    const items = readArray(readPath(result.data, "user", "clips", "edges"))
      .map((edge) => readPath(edge, "node"))
      .map((item) => mapClipItem(item))
      .filter(Boolean)
      .slice(0, limit) as Array<Record<string, unknown>>;

    return {
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "clips",
      message: `Loaded ${items.length} Twitch clip${items.length === 1 ? "" : "s"} for ${resolved.username}.`,
      data: {
        target: resolved.username,
        period: input.period ?? "all-time",
        items,
        meta: {
          count: items.length,
          listKey: "items",
        },
      },
    };
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Twitch media posting is not implemented yet.");
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Twitch text posting is not implemented yet.");
  }

  async like(_input: LikeInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Twitch like actions are not implemented yet.");
  }

  async comment(_input: CommentInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Twitch comment actions are not implemented yet.");
  }

  private async probeImportedSession(jar: CookieJar): Promise<TwitchProbe> {
    const accessToken = await this.extractCookieValue(jar, "auth-token");
    if (!accessToken) {
      throw new AutoCliError("TWITCH_AUTH_TOKEN_MISSING", "Expected the Twitch cookie export to include auth-token.", {
        details: {
          cookie: "auth-token",
        },
      });
    }

    const apiToken = await this.extractCookieValue(jar, "api_token");
    return this.probeToken(accessToken, apiToken);
  }

  private async probeStoredSession(session: PlatformSession): Promise<TwitchProbe> {
    const jar = await this.cookieManager.createJar(session);
    const accessToken = readMetadataString(session.metadata, "accessToken") ?? (await this.extractCookieValue(jar, "auth-token"));
    if (!accessToken) {
      return {
        status: {
          state: "expired",
          message: "The saved Twitch session no longer contains auth-token.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "TWITCH_AUTH_TOKEN_MISSING",
        },
      };
    }

    const apiToken = readMetadataString(session.metadata, "apiToken") ?? (await this.extractCookieValue(jar, "api_token"));
    return this.probeToken(accessToken, apiToken, session.metadata);
  }

  private async probeToken(accessToken: string, apiToken?: string, currentMetadata?: Record<string, unknown>): Promise<TwitchProbe> {
    try {
      const validated = await this.validateToken(accessToken);
      return {
        status: {
          state: "active",
          message: "Session validated.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: {
          id: validated.user_id,
          username: validated.login,
          displayName: validated.login,
          profileUrl: validated.login ? `${TWITCH_HOME_URL}${validated.login}` : undefined,
        },
        metadata: {
          ...(currentMetadata ?? {}),
          accessToken,
          apiToken,
          clientId: validated.client_id ?? readMetadataString(currentMetadata, "clientId") ?? TWITCH_WEB_CLIENT_ID,
          login: validated.login,
          userId: validated.user_id,
          scopes: validated.scopes ?? [],
        },
      };
    } catch (error) {
      if (error instanceof AutoCliError && error.code === "TWITCH_VALIDATE_FAILED") {
        return {
          status: {
            state: "expired",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
          metadata: {
            ...(currentMetadata ?? {}),
            accessToken,
            apiToken,
            clientId: readMetadataString(currentMetadata, "clientId") ?? TWITCH_WEB_CLIENT_ID,
          },
        };
      }

      throw error;
    }
  }

  private async loadAuthorizedContext(account?: string): Promise<TwitchAuthContext> {
    const { session, path } = await this.loadSession(account);
    const jar = await this.cookieManager.createJar(session);
    const accessToken = readMetadataString(session.metadata, "accessToken") ?? (await this.extractCookieValue(jar, "auth-token"));
    if (!accessToken) {
      throw new AutoCliError("TWITCH_AUTH_TOKEN_MISSING", "The saved Twitch session no longer contains auth-token.", {
        details: {
          account: session.account,
          sessionPath: path,
        },
      });
    }

    const login = readMetadataString(session.metadata, "login") ?? session.user?.username;
    const userId = readMetadataString(session.metadata, "userId") ?? session.user?.id;
    if (!login) {
      const validated = await this.validateToken(accessToken);
      const updatedSession = await this.persistExistingSession(session, {
        jar,
        user: {
          id: validated.user_id,
          username: validated.login,
          displayName: validated.login,
          profileUrl: validated.login ? `${TWITCH_HOME_URL}${validated.login}` : undefined,
        },
        status: {
          state: "active",
          message: "Session validated.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: {
          ...(session.metadata ?? {}),
          accessToken,
          apiToken: readMetadataString(session.metadata, "apiToken") ?? (await this.extractCookieValue(jar, "api_token")),
          clientId: validated.client_id ?? TWITCH_WEB_CLIENT_ID,
          login: validated.login,
          userId: validated.user_id,
          scopes: validated.scopes ?? [],
        },
      });

      return {
        session: updatedSession,
        path,
        accessToken,
        clientId: validated.client_id ?? TWITCH_WEB_CLIENT_ID,
        login: validated.login ?? session.account,
        userId: validated.user_id,
      };
    }

    return {
      session,
      path,
      accessToken,
      clientId: readMetadataString(session.metadata, "clientId") ?? TWITCH_WEB_CLIENT_ID,
      login,
      userId,
    };
  }

  private async validateToken(accessToken: string): Promise<TwitchValidateResponse> {
    const response = await fetch(TWITCH_VALIDATE_ENDPOINT, {
      headers: {
        authorization: `OAuth ${accessToken}`,
        "user-agent": "AutoCLI/1.0",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new AutoCliError("TWITCH_VALIDATE_FAILED", "Twitch rejected the saved session during token validation.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 500),
        },
      });
    }

    return parseJson<TwitchValidateResponse>(text, "TWITCH_VALIDATE_FAILED");
  }

  private async gqlBatch(context: TwitchAuthContext, operations: TwitchOperationInput[]): Promise<TwitchGraphQlResult[]> {
    const payload = operations.map((operationInput) => ({
      operationName: operationInput.operationName,
      variables: operationInput.variables,
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: operationInput.sha256Hash,
        },
      },
    }));

    const response = await fetch(TWITCH_GQL_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `OAuth ${context.accessToken}`,
        "client-id": context.clientId,
        "content-type": "text/plain;charset=UTF-8",
        accept: "*/*",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (!response.ok) {
      const code = response.status === 401 ? "SESSION_EXPIRED" : "TWITCH_REQUEST_FAILED";
      throw new AutoCliError(code, "Twitch rejected the GraphQL request.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 1000),
        },
      });
    }

    const parsed = parseJson<unknown>(text, "TWITCH_REQUEST_FAILED");
    if (!Array.isArray(parsed)) {
      throw new AutoCliError("TWITCH_RESPONSE_INVALID", "Twitch returned an unexpected GraphQL response shape.");
    }

    return parsed.map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        throw new AutoCliError("TWITCH_RESPONSE_INVALID", "Twitch returned an unexpected GraphQL response item.", {
          details: {
            index,
          },
        });
      }

      const errors = readArray(record.errors)
        .map((item) => asRecord(item))
        .filter(Boolean) as Array<Record<string, unknown>>;
      if (errors.length > 0) {
        const firstMessage = readString(errors[0]?.message) ?? "Unknown Twitch GraphQL error.";
        throw new AutoCliError(firstMessage.toLowerCase().includes("oauth") ? "SESSION_EXPIRED" : "TWITCH_REQUEST_FAILED", firstMessage, {
          details: {
            operationName: operations[index]?.operationName,
            errors,
          },
        });
      }

      return {
        data: asRecord(record.data) ?? undefined,
      };
    });
  }

  private async extractCookieValue(jar: CookieJar, key: string): Promise<string | undefined> {
    const cookies = await jar.getCookies(TWITCH_HOME_URL);
    const match = cookies.find((cookie) => cookie.key === key);
    return match?.value || undefined;
  }
}

export function parseTwitchClipPeriodOption(value: string): TwitchClipPeriod {
  switch (value.trim().toLowerCase()) {
    case "all":
    case "all-time":
    case "all_time":
      return "all-time";
    case "week":
    case "last-week":
    case "last_week":
      return "last-week";
    case "day":
    case "last-day":
    case "last_day":
      return "last-day";
    default:
      throw new AutoCliError("TWITCH_PERIOD_INVALID", "Expected --period to be all-time, last-week, or last-day.", {
        details: { value },
      });
  }
}

function operation(definition: { operationName: string; sha256Hash: string }, variables: Record<string, unknown>): TwitchOperationInput {
  return {
    operationName: definition.operationName,
    sha256Hash: definition.sha256Hash,
    variables,
  };
}

function toClipFilter(period: TwitchClipPeriod | undefined): string {
  switch (period) {
    case "last-day":
      return "LAST_DAY";
    case "last-week":
      return "LAST_WEEK";
    default:
      return "ALL_TIME";
  }
}

function findExactSearchItem(data: Record<string, unknown> | undefined, username: string): Record<string, unknown> | undefined {
  const lowered = username.toLowerCase();
  return readArray(readPath(data, "searchFor", "channels", "edges"))
    .map((edge) => readPath(edge, "item"))
    .find((item) => readString(asRecord(item)?.login)?.toLowerCase() === lowered) as Record<string, unknown> | undefined;
}

function mapSearchItem(item: unknown): Record<string, unknown> | undefined {
  const record = asRecord(item);
  const login = readString(record?.login);
  if (!record || !login) {
    return undefined;
  }

  const live = Boolean(asRecord(record.stream));
  const followers = readNumber(readPath(record, "followers", "totalCount"));
  const latestVideo = readArray(readPath(record, "latestVideo", "edges"))[0];
  const topClip = readArray(readPath(record, "topClip", "edges"))[0];

  return {
    id: readString(record.id),
    title: readString(record.displayName) ?? login,
    username: login,
    displayName: readString(record.displayName) ?? login,
    summary: readString(record.description),
    followers,
    url: `${TWITCH_HOME_URL}${login}`,
    profileImageUrl: readString(record.profileImageURL),
    latestVideoUrl: buildVideoUrl(readPath(latestVideo, "node", "id")),
    topClipUrl: readString(readPath(topClip, "node", "url")),
    live,
    metrics: compact([
      typeof followers === "number" ? `${followers} followers` : undefined,
      live ? "live" : "offline",
      readString(readPath(record, "stream", "game", "displayName")) ? `game: ${readString(readPath(record, "stream", "game", "displayName"))}` : undefined,
      readNumber(readPath(record, "stream", "viewersCount")) ? `${readNumber(readPath(record, "stream", "viewersCount"))} viewers` : undefined,
    ]),
  };
}

function mapTwitchProfile(input: {
  login: string;
  shellUser?: unknown;
  homeUser?: unknown;
  avatarUser?: unknown;
  currentUser?: unknown;
  searchItem?: unknown;
}): Record<string, unknown> {
  const shellUser = asRecord(input.shellUser);
  const homeUser = asRecord(input.homeUser);
  const avatarUser = asRecord(input.avatarUser);
  const currentUser = asRecord(input.currentUser);
  const searchItem = asRecord(input.searchItem);
  const nextSegment = asRecord(readPath(homeUser, "channel", "schedule", "nextSegment"));
  const latestVideo = readArray(readPath(searchItem, "latestVideo", "edges"))[0];
  const topClip = readArray(readPath(searchItem, "topClip", "edges"))[0];

  return {
    id: readString(shellUser?.id) ?? readString(homeUser?.id) ?? readString(avatarUser?.id),
    displayName: readString(shellUser?.displayName) ?? readString(homeUser?.displayName) ?? readString(searchItem?.displayName) ?? input.login,
    username: readString(shellUser?.login) ?? readString(homeUser?.login) ?? input.login,
    bio: readString(homeUser?.description),
    followers: readNumber(readPath(avatarUser, "followers", "totalCount")) ?? readNumber(readPath(searchItem, "followers", "totalCount")),
    partner: Boolean(readPath(homeUser, "roles", "isPartner")),
    affiliate: Boolean(readPath(homeUser, "roles", "isAffiliate")),
    live: Boolean(asRecord(shellUser?.stream) ?? asRecord(searchItem?.stream)),
    viewersCount: readNumber(readPath(shellUser, "stream", "viewersCount")) ?? readNumber(readPath(searchItem, "stream", "viewersCount")),
    visibility: readString(readPath(currentUser, "settings", "visibility")),
    profileImageUrl: readString(shellUser?.profileImageURL) ?? readString(searchItem?.profileImageURL) ?? readString(currentUser?.profileImageURL),
    bannerImageUrl: readString(shellUser?.bannerImageURL),
    primaryColorHex: readString(shellUser?.primaryColorHex) ?? readString(avatarUser?.primaryColorHex),
    trailerUrl: buildVideoUrl(readPath(shellUser, "channel", "trailer", "video", "id") ?? readPath(homeUser, "channel", "trailer", "video", "id")),
    latestVideoUrl: buildVideoUrl(readPath(latestVideo, "node", "id")),
    topClipUrl: readString(readPath(topClip, "node", "url")),
    socialLinks: readArray(readPath(homeUser, "channel", "socialMedias"))
      .map((item) => {
        const social = asRecord(item);
        if (!social) {
          return undefined;
        }
        return compact([readString(social.title), readString(social.url)]).join(": ");
      })
      .filter((value): value is string => Boolean(value)),
    schedule:
      nextSegment && readString(nextSegment.title)
        ? compact([
            readString(nextSegment.title),
            readString(nextSegment.startAt),
            readString(nextSegment.endAt),
          ]).join(" • ")
        : undefined,
    url: `${TWITCH_HOME_URL}${readString(shellUser?.login) ?? readString(homeUser?.login) ?? input.login}`,
  };
}

function mapStreamEntity(shellUserInput: unknown, liveUserInput: unknown, searchItemInput: unknown): Record<string, unknown> {
  const shellUser = asRecord(shellUserInput);
  const liveUser = asRecord(liveUserInput);
  const searchItem = asRecord(searchItemInput);
  const login = readString(shellUser?.login) ?? readString(searchItem?.login) ?? "unknown";

  return {
    id: readString(readPath(shellUser, "stream", "id")) ?? readString(readPath(liveUser, "stream", "id")) ?? readString(shellUser?.id),
    username: login,
    displayName: readString(shellUser?.displayName) ?? readString(searchItem?.displayName) ?? login,
    live: Boolean(asRecord(shellUser?.stream)),
    title: readString(readPath(searchItem, "broadcastSettings", "title")),
    game: readString(readPath(searchItem, "stream", "game", "displayName")),
    viewersCount: readNumber(readPath(shellUser, "stream", "viewersCount")) ?? readNumber(readPath(searchItem, "stream", "viewersCount")),
    startedAt: readString(readPath(liveUser, "stream", "createdAt")),
    previewImageUrl: readString(readPath(searchItem, "stream", "previewImageURL")),
    url: `${TWITCH_HOME_URL}${login}`,
  };
}

function mapVideoItem(item: unknown, shelf: Record<string, unknown>): Record<string, unknown> | undefined {
  const record = asRecord(item);
  const id = readString(record?.id);
  const title = readString(record?.title);
  if (!record || !id || !title) {
    return undefined;
  }

  return {
    id,
    title,
    username: readString(readPath(record, "owner", "login")),
    publishedAt: readString(record.publishedAt),
    summary: readString(shelf.title),
    url: buildVideoUrl(id),
    metrics: compact([
      readNumber(record.viewCount) !== undefined ? `${readNumber(record.viewCount)} views` : undefined,
      readNumber(record.lengthSeconds) !== undefined ? `${readNumber(record.lengthSeconds)}s` : undefined,
      readString(readPath(record, "game", "displayName")) ? `game: ${readString(readPath(record, "game", "displayName"))}` : undefined,
      readString(shelf.title) ? `shelf: ${readString(shelf.title)}` : undefined,
    ]),
  };
}

function mapClipItem(item: unknown): Record<string, unknown> | undefined {
  const record = asRecord(item);
  const id = readString(record?.id);
  const title = readString(record?.title);
  if (!record || !id || !title) {
    return undefined;
  }

  return {
    id,
    title,
    username: readString(readPath(record, "broadcaster", "login")),
    publishedAt: readString(record.createdAt),
    summary: readString(readPath(record, "game", "displayName")),
    url: readString(record.url),
    metrics: compact([
      readNumber(record.viewCount) !== undefined ? `${readNumber(record.viewCount)} views` : undefined,
      readNumber(record.durationSeconds) !== undefined ? `${readNumber(record.durationSeconds)}s` : undefined,
      readString(record.language) ? `lang: ${readString(record.language)}` : undefined,
    ]),
  };
}

function parseJson<T>(text: string, code: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new AutoCliError(code, "Failed to parse the Twitch response.", {
      cause: error,
      details: {
        body: text.slice(0, 500),
      },
    });
  }
}

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPath(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function compact(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0);
}

function buildVideoUrl(id: unknown): string | undefined {
  const videoId = readString(id);
  return videoId ? `https://www.twitch.tv/videos/${videoId}` : undefined;
}

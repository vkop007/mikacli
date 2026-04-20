import { randomUUID } from "node:crypto";

import { MikaCliError } from "../../../errors.js";
import {
  runFirstClassBrowserAction,
  withBrowserActionMetadata,
} from "../../../core/runtime/browser-action-runtime.js";
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
import type { Locator as PlaywrightLocator, Page as PlaywrightPage, Response as PlaywrightResponse } from "playwright-core";

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_GQL_INTEGRITY_ENDPOINT = "https://gql.twitch.tv/integrity";
const TWITCH_HOME_URL = "https://www.twitch.tv/";
const TWITCH_VALIDATE_ENDPOINT = "https://id.twitch.tv/oauth2/validate";
const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const TWITCH_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const TWITCH_DEFAULT_BROWSER_TIMEOUT_SECONDS = 90;
const TWITCH_DEFAULT_CLIENT_VERSION = "2d28bfe6-4ba9-43cf-980f-28b0e27b7a54";
const TWITCH_DEFAULT_LOCALE = "en-US";

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
  canCreateClip: {
    operationName: "CanCreateClip",
    sha256Hash: "ea1796b7893cd9ab447c989967e8441ea230ea54091f63e71d4b189b72d17215",
  },
  videoPlayerClipsButtonBroadcaster: {
    operationName: "VideoPlayerClipsButtonBroadcaster",
    sha256Hash: "784065d408671ee105d64241cc6f461b1c32684d837734fa2f4c761229a7efcd",
  },
  settingsChannelClipsSettings: {
    operationName: "Settings_ChannelClipsSettings",
    sha256Hash: "881f668cb5426259033ae6f7f54b4a38bc6552005a79311fabbce5cb1873bc53",
  },
} as const;

const TWITCH_FOLLOW_USER_QUERY = `
  query FollowButton_User($login: String!) {
    user(login: $login) {
      id
      login
      displayName
      self {
        canFollow
        follower {
          followedAt
          disableNotifications
          node {
            id
          }
        }
      }
    }
  }
`;

const TWITCH_FOLLOW_USER_MUTATION = `
  mutation FollowButton_FollowUser($input: FollowUserInput!) {
    followUser(input: $input) {
      follow {
        disableNotifications
        user {
          id
          login
          displayName
          self {
            canFollow
            follower {
              followedAt
              disableNotifications
              node {
                id
              }
            }
          }
        }
      }
      error {
        code
      }
    }
  }
`;

const TWITCH_UNFOLLOW_USER_MUTATION = `
  mutation FollowButton_UnfollowUser($input: UnfollowUserInput!) {
    unfollowUser(input: $input) {
      follow {
        disableNotifications
        user {
          id
          login
          displayName
          self {
            canFollow
            follower {
              followedAt
              disableNotifications
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`;

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

interface TwitchRawOperationInput {
  operationName: string;
  query: string;
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

interface TwitchBrowserWriteInput {
  browser?: boolean;
  browserTimeoutSeconds?: number;
}

interface TwitchFollowTarget {
  id: string;
  username: string;
  displayName: string;
  url: string;
  isFollowing: boolean;
  canFollow: boolean;
}

interface TwitchWebGraphQlContext {
  clientVersion: string;
  clientSessionId: string;
  deviceId: string;
  cookieHeader?: string;
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
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "Twitch session has expired.", {
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
          recommendedNextCommand: `mikacli social twitch me${account === "default" ? "" : ` --account ${account}`}`,
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
      throw new MikaCliError("TWITCH_QUERY_REQUIRED", "Provide a Twitch query to search.");
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
        requestID: `mikacli-${Date.now()}`,
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
        requestID: `mikacli-${resolved.username}`,
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
      throw new MikaCliError("TWITCH_CHANNEL_NOT_FOUND", `Twitch could not find channel ${resolved.username}.`, {
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
        requestID: `mikacli-stream-${resolved.username}`,
      }),
    ]);
    const shellResult = results[0]!;
    const liveResult = results[1]!;
    const searchResult = results[2]!;

    const shellUser = readPath(shellResult.data, "userOrError");
    if (!shellUser) {
      throw new MikaCliError("TWITCH_CHANNEL_NOT_FOUND", `Twitch could not find channel ${resolved.username}.`, {
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

  async follow(input: LikeInput & TwitchBrowserWriteInput): Promise<AdapterActionResult> {
    const context = await this.loadAuthorizedContext(input.account);
    const target = await this.resolveFollowTarget(context, input.target);

    if (target.isFollowing) {
      return {
        ok: true,
        platform: this.platform,
        account: context.session.account,
        action: "follow",
        message: `Twitch is already following ${target.username}.`,
        id: target.id,
        url: target.url,
        data: {
          username: target.username,
          following: true,
          alreadyFollowing: true,
        },
      };
    }

    try {
      await this.mutateFollowState(context, "follow", target.id);
      return {
        ok: true,
        platform: this.platform,
        account: context.session.account,
        action: "follow",
        message: `Twitch follow request sent for ${target.username}.`,
        id: target.id,
        url: target.url,
        data: {
          username: target.username,
          following: true,
          alreadyFollowing: false,
          mode: "web-graphql",
        },
      };
    } catch (error) {
      if (!(error instanceof MikaCliError) || error.code !== "TWITCH_INTEGRITY_REQUIRED") {
        throw error;
      }

      if (!input.browser) {
        throw new MikaCliError(
          "TWITCH_BROWSER_LOGIN_REQUIRED",
          "Twitch follow currently needs the shared MikaCLI browser profile to already be logged into twitch.tv. Re-run with `--browser` after `mikacli login --browser`.",
          {
            cause: error,
            details: {
              target: input.target,
              username: target.username,
              url: target.url,
            },
          },
        );
      }
    }

    const execution = await runFirstClassBrowserAction<{
      source: "headless" | "profile" | "shared";
      finalUrl?: string;
    }>({
      platform: this.platform,
      action: "follow",
      actionLabel: "follow",
      targetUrl: target.url,
      timeoutSeconds: input.browserTimeoutSeconds ?? TWITCH_DEFAULT_BROWSER_TIMEOUT_SECONDS,
      mode: "required",
      strategy: "shared-only",
      announceLabel: `Opening shared MikaCLI browser profile for Twitch follow: ${target.url}`,
      actionFn: async (page, source) => {
        await this.ensureTwitchBrowserAuthenticated(page);
        await page.goto(target.url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await page.waitForTimeout(2_000);

        const responsePromise = this.waitForTwitchGraphQlOperation(page, "FollowButton_FollowUser", 15_000);
        const followButton = await this.waitForTwitchFollowButton(page, "follow");
        await followButton.click();
        const response = await responsePromise;

        if (!response) {
          await this.throwIfTwitchBrowserUnauthenticated(page);
          throw new MikaCliError("TWITCH_BROWSER_ACTION_FAILED", "Twitch did not send the follow request from the browser flow.");
        }

        await this.assertTwitchBrowserMutationSucceeded(response, "FollowButton_FollowUser");

        return {
          source,
          finalUrl: page.url(),
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "follow",
      message: `Twitch follow request sent for ${target.username} through the shared browser flow.`,
      id: target.id,
      url: execution.value.finalUrl ?? target.url,
      data: {
        username: target.username,
        following: true,
        alreadyFollowing: false,
        mode: "browser",
      },
    }, execution);
  }

  async unfollow(input: LikeInput & TwitchBrowserWriteInput): Promise<AdapterActionResult> {
    const context = await this.loadAuthorizedContext(input.account);
    const target = await this.resolveFollowTarget(context, input.target);

    if (!target.isFollowing) {
      return {
        ok: true,
        platform: this.platform,
        account: context.session.account,
        action: "unfollow",
        message: `Twitch was already not following ${target.username}.`,
        id: target.id,
        url: target.url,
        data: {
          username: target.username,
          following: false,
          alreadyUnfollowed: true,
        },
      };
    }

    try {
      await this.mutateFollowState(context, "unfollow", target.id);
      return {
        ok: true,
        platform: this.platform,
        account: context.session.account,
        action: "unfollow",
        message: `Twitch unfollow request sent for ${target.username}.`,
        id: target.id,
        url: target.url,
        data: {
          username: target.username,
          following: false,
          alreadyUnfollowed: false,
          mode: "web-graphql",
        },
      };
    } catch (error) {
      if (!(error instanceof MikaCliError) || error.code !== "TWITCH_INTEGRITY_REQUIRED") {
        throw error;
      }

      if (!input.browser) {
        throw new MikaCliError(
          "TWITCH_BROWSER_LOGIN_REQUIRED",
          "Twitch unfollow currently needs the shared MikaCLI browser profile to already be logged into twitch.tv. Re-run with `--browser` after `mikacli login --browser`.",
          {
            cause: error,
            details: {
              target: input.target,
              username: target.username,
              url: target.url,
            },
          },
        );
      }
    }

    const execution = await runFirstClassBrowserAction<{
      source: "headless" | "profile" | "shared";
      finalUrl?: string;
    }>({
      platform: this.platform,
      action: "unfollow",
      actionLabel: "unfollow",
      targetUrl: target.url,
      timeoutSeconds: input.browserTimeoutSeconds ?? TWITCH_DEFAULT_BROWSER_TIMEOUT_SECONDS,
      mode: "required",
      strategy: "shared-only",
      announceLabel: `Opening shared MikaCLI browser profile for Twitch unfollow: ${target.url}`,
      actionFn: async (page, source) => {
        await this.ensureTwitchBrowserAuthenticated(page);
        await page.goto(target.url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await page.waitForTimeout(2_000);

        const responsePromise = this.waitForTwitchGraphQlOperation(page, "FollowButton_UnfollowUser", 15_000);
        const unfollowButton = await this.waitForTwitchFollowButton(page, "unfollow");
        await unfollowButton.click();
        await this.confirmTwitchBrowserUnfollow(page);
        const response = await responsePromise;

        if (!response) {
          await this.throwIfTwitchBrowserUnauthenticated(page);
          throw new MikaCliError("TWITCH_BROWSER_ACTION_FAILED", "Twitch did not send the unfollow request from the browser flow.");
        }

        await this.assertTwitchBrowserMutationSucceeded(response, "FollowButton_UnfollowUser");

        return {
          source,
          finalUrl: page.url(),
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "unfollow",
      message: `Twitch unfollow request sent for ${target.username} through the shared browser flow.`,
      id: target.id,
      url: execution.value.finalUrl ?? target.url,
      data: {
        username: target.username,
        following: false,
        alreadyUnfollowed: false,
        mode: "browser",
      },
    }, execution);
  }

  async createClip(input: LikeInput & TwitchBrowserWriteInput): Promise<AdapterActionResult> {
    const resolved = parseTwitchProfileTarget(input.target);
    const context = await this.loadAuthorizedContext(input.account);
    const stream = await this.streamInfo({
      account: context.session.account,
      target: resolved.username,
    });
    const streamEntity = asRecord(stream.data?.stream) ?? asRecord(stream.data?.entity);
    if (!streamEntity || readString(streamEntity.url) !== `${TWITCH_HOME_URL}${resolved.username}` || streamEntity.live !== true) {
      throw new MikaCliError("TWITCH_CLIP_REQUIRES_LIVE_STREAM", `Twitch can only create clips from a live stream. ${resolved.username} is not live right now.`);
    }

    const targetUrl = readString(streamEntity.url) ?? `${TWITCH_HOME_URL}${resolved.username}`;
    const execution = await runFirstClassBrowserAction<{
      source: "headless" | "profile" | "shared";
      finalUrl?: string;
      clipUrl?: string;
      clipSlug?: string;
    }>({
      platform: this.platform,
      action: "create-clip",
      actionLabel: "clip creation",
      targetUrl,
      timeoutSeconds: input.browserTimeoutSeconds ?? TWITCH_DEFAULT_BROWSER_TIMEOUT_SECONDS,
      mode: "required",
      strategy: "shared-only",
      announceLabel: `Opening shared MikaCLI browser profile for Twitch clip creation: ${targetUrl}`,
      actionFn: async (page, source) => {
        await this.ensureTwitchBrowserAuthenticated(page);
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await page.waitForTimeout(3_000);

        const responsePromise = this.waitForTwitchClipCreateResponse(page, 20_000);
        const clipButton = await this.waitForTwitchClipButton(page);
        await clipButton.click();
        await page.waitForTimeout(1_500);
        await this.tryConfirmTwitchClipSave(page);
        const response = await responsePromise;

        await this.throwIfTwitchBrowserUnauthenticated(page);

        const payload = response ? await response.json().catch(() => null) as unknown : null;
        const clipSlug = findFirstString(payload, ["slug", "clipSlug"]);
        const clipUrl = findFirstString(payload, ["url"]) ?? await this.resolveTwitchClipUrlFromPage(page).catch(() => undefined);

        return {
          source,
          finalUrl: page.url(),
          clipUrl,
          clipSlug,
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "create-clip",
      message: `Twitch clip creation started for ${resolved.username} through the shared browser flow.`,
      id: execution.value.clipSlug,
      url: execution.value.clipUrl ?? execution.value.finalUrl ?? targetUrl,
      data: {
        target: resolved.username,
        clipUrl: execution.value.clipUrl,
      },
    }, execution);
  }

  async updateStream(input: {
    account?: string;
    title?: string;
    category?: string;
    tags?: string[];
    clearTags?: boolean;
    mature?: boolean;
    browser?: boolean;
    browserTimeoutSeconds?: number;
  }): Promise<AdapterActionResult> {
    const title = input.title?.trim();
    const category = input.category?.trim();
    const tags = (input.tags ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    const clearTags = Boolean(input.clearTags);
    const shouldSetMature = typeof input.mature === "boolean";

    if (!title && !category && tags.length === 0 && !clearTags && !shouldSetMature) {
      throw new MikaCliError("TWITCH_UPDATE_STREAM_EMPTY", "Provide at least one Twitch stream field to update.");
    }

    const context = await this.loadAuthorizedContext(input.account);
    const settingsUrl = `https://dashboard.twitch.tv/u/${context.login}/settings/stream`;
    const execution = await runFirstClassBrowserAction<{
      source: "headless" | "profile" | "shared";
      finalUrl?: string;
    }>({
      platform: this.platform,
      action: "update-stream",
      actionLabel: "stream update",
      targetUrl: settingsUrl,
      timeoutSeconds: input.browserTimeoutSeconds ?? TWITCH_DEFAULT_BROWSER_TIMEOUT_SECONDS,
      mode: "required",
      strategy: "shared-only",
      announceLabel: `Opening shared MikaCLI browser profile for Twitch stream settings: ${settingsUrl}`,
      actionFn: async (page, source) => {
        await this.ensureTwitchBrowserAuthenticated(page);
        await page.goto(settingsUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await page.waitForTimeout(3_000);

        if (title) {
          await this.fillTwitchDashboardTextInput(page, [/stream title/i, /^title$/i], title);
        }

        if (category) {
          await this.fillTwitchDashboardComboBox(page, [/category/i, /game/i], category);
        }

        if (clearTags || tags.length > 0) {
          await this.updateTwitchDashboardTags(page, tags, clearTags);
        }

        if (shouldSetMature) {
          await this.setTwitchDashboardCheckbox(page, [/mature/i], input.mature as boolean);
        }

        const savePromise = this.waitForAnyTwitchSettingsMutation(page, 20_000);
        const saveButton = await this.waitForTwitchSaveButton(page);
        await saveButton.click();
        await savePromise.catch(() => undefined);
        await page.waitForTimeout(1_500);

        return {
          source,
          finalUrl: page.url(),
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: context.session.account,
      action: "update-stream",
      message: `Twitch stream settings updated for ${context.login} through the shared browser flow.`,
      url: execution.value.finalUrl ?? settingsUrl,
      data: {
        title,
        category,
        tags,
        clearTags,
        mature: shouldSetMature ? input.mature : undefined,
      },
    }, execution);
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw new MikaCliError("UNSUPPORTED_ACTION", "Twitch media posting is not implemented yet.");
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new MikaCliError("UNSUPPORTED_ACTION", "Twitch text posting is not implemented yet.");
  }

  async like(_input: LikeInput): Promise<AdapterActionResult> {
    throw new MikaCliError("UNSUPPORTED_ACTION", "Twitch like actions are not implemented yet.");
  }

  async comment(_input: CommentInput): Promise<AdapterActionResult> {
    throw new MikaCliError("UNSUPPORTED_ACTION", "Twitch comment actions are not implemented yet.");
  }

  private async resolveFollowTarget(context: TwitchAuthContext, targetInput: string): Promise<TwitchFollowTarget> {
    const resolved = parseTwitchProfileTarget(targetInput);
    const result = await this.gqlRaw(
      context,
      {
        operationName: "FollowButton_User",
        query: TWITCH_FOLLOW_USER_QUERY,
        variables: {
          login: resolved.username,
        },
      },
      {
        includeIntegrity: false,
      },
    );
    const user = asRecord(readPath(result.data, "user"));
    const targetId = readString(user?.id);
    if (!user || !targetId) {
      throw new MikaCliError("TWITCH_CHANNEL_NOT_FOUND", `Twitch could not find channel ${resolved.username}.`, {
        details: {
          target: targetInput,
          username: resolved.username,
        },
      });
    }

    const username = readString(user.login) ?? resolved.username;
    const displayName = readString(user.displayName) ?? username;
    const isFollowing = Boolean(asRecord(readPath(user, "self", "follower")));
    const canFollow = Boolean(readPath(user, "self", "canFollow"));

    return {
      id: targetId,
      username,
      displayName,
      url: `${TWITCH_HOME_URL}${username}`,
      isFollowing,
      canFollow,
    };
  }

  private async mutateFollowState(
    context: TwitchAuthContext,
    action: "follow" | "unfollow",
    targetId: string,
  ): Promise<void> {
    const operationName = action === "follow" ? "FollowButton_FollowUser" : "FollowButton_UnfollowUser";
    const operationResultKey = action === "follow" ? "followUser" : "unfollowUser";
    const mutation = action === "follow" ? TWITCH_FOLLOW_USER_MUTATION : TWITCH_UNFOLLOW_USER_MUTATION;
    const mutationInput =
      action === "follow"
        ? {
            targetID: targetId,
            disableNotifications: false,
          }
        : {
            targetID: targetId,
          };

    const result = await this.gqlRaw(context, {
      operationName,
      query: mutation,
      variables: {
        input: mutationInput,
      },
    });
    const payload = asRecord(readPath(result.data, operationResultKey));
    if (!payload) {
      throw new MikaCliError("TWITCH_REQUEST_FAILED", `Twitch returned an empty ${action} mutation payload.`, {
        details: {
          operationName,
          targetId,
        },
      });
    }

    const errorCode = readString(readPath(payload, "error", "code"));
    if (errorCode) {
      throw new MikaCliError("TWITCH_REQUEST_FAILED", `Twitch rejected the ${action} request with ${errorCode}.`, {
        details: {
          operationName,
          targetId,
          errorCode,
        },
      });
    }
  }

  private async gqlRaw(
    context: TwitchAuthContext,
    operationInput: TwitchRawOperationInput,
    options: {
      includeIntegrity?: boolean;
    } = {},
  ): Promise<TwitchGraphQlResult> {
    const webContext = await this.buildTwitchWebGraphQlContext(context);
    const headers: Record<string, string> = {
      authorization: `OAuth ${context.accessToken}`,
      "client-id": context.clientId,
      "client-session-id": webContext.clientSessionId,
      "client-version": webContext.clientVersion,
      "content-type": "text/plain;charset=UTF-8",
      accept: "*/*",
      "device-id": webContext.deviceId,
      "x-device-id": webContext.deviceId,
      "x-localization": TWITCH_DEFAULT_LOCALE,
      referer: TWITCH_HOME_URL,
      "user-agent": TWITCH_BROWSER_USER_AGENT,
    };
    if (webContext.cookieHeader) {
      headers.cookie = webContext.cookieHeader;
    }

    if (options.includeIntegrity !== false) {
      const integrityToken = await this.fetchTwitchIntegrityToken(context, webContext).catch(() => undefined);
      if (integrityToken) {
        headers["client-integrity"] = integrityToken;
      }
    }

    const response = await fetch(TWITCH_GQL_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operationName: operationInput.operationName,
        query: operationInput.query,
        variables: operationInput.variables,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      const code = response.status === 401 ? "SESSION_EXPIRED" : "TWITCH_REQUEST_FAILED";
      throw new MikaCliError(code, "Twitch rejected the GraphQL request.", {
        details: {
          operationName: operationInput.operationName,
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 1000),
        },
      });
    }

    const parsed = parseJson<unknown>(text, "TWITCH_REQUEST_FAILED");
    const record = firstTwitchGraphQlEnvelope(parsed);
    if (!record) {
      throw new MikaCliError("TWITCH_RESPONSE_INVALID", "Twitch returned an unexpected GraphQL response shape.", {
        details: {
          operationName: operationInput.operationName,
        },
      });
    }

    const errors = readArray(record.errors)
      .map((entry) => asRecord(entry))
      .filter(Boolean) as Array<Record<string, unknown>>;
    if (errors.length > 0) {
      const firstMessage = readString(errors[0]?.message) ?? "Unknown Twitch GraphQL error.";
      if (hasTwitchIntegrityChallenge(errors)) {
        throw new MikaCliError("TWITCH_INTEGRITY_REQUIRED", "Twitch rejected the write request behind an integrity challenge.", {
          details: {
            operationName: operationInput.operationName,
            errors,
          },
        });
      }

      throw new MikaCliError(firstMessage.toLowerCase().includes("oauth") ? "SESSION_EXPIRED" : "TWITCH_REQUEST_FAILED", firstMessage, {
        details: {
          operationName: operationInput.operationName,
          errors,
        },
      });
    }

    return {
      data: asRecord(record.data) ?? undefined,
    };
  }

  private async buildTwitchWebGraphQlContext(context: TwitchAuthContext): Promise<TwitchWebGraphQlContext> {
    const cookieHeader = serializeTwitchCookieHeader(context.session);
    const metadata = context.session.metadata;
    return {
      clientVersion:
        readMetadataString(metadata, "clientVersion") ??
        readMetadataString(metadata, "twilightBuildId") ??
        TWITCH_DEFAULT_CLIENT_VERSION,
      clientSessionId:
        readMetadataString(metadata, "clientSessionId") ??
        readMetadataString(metadata, "appSessionId") ??
        randomTwitchIdentifier(16),
      deviceId:
        readMetadataString(metadata, "deviceId") ??
        readMetadataString(metadata, "localStorageDeviceId") ??
        readSerializedSessionCookieValue(context.session, "unique_id") ??
        randomTwitchIdentifier(32),
      cookieHeader,
    };
  }

  private async fetchTwitchIntegrityToken(
    context: TwitchAuthContext,
    webContext: TwitchWebGraphQlContext,
  ): Promise<string | undefined> {
    const headers: Record<string, string> = {
      authorization: `OAuth ${context.accessToken}`,
      "client-id": context.clientId,
      "client-session-id": webContext.clientSessionId,
      "client-version": webContext.clientVersion,
      "content-type": "text/plain;charset=UTF-8",
      accept: "*/*",
      "device-id": webContext.deviceId,
      "x-device-id": webContext.deviceId,
      referer: TWITCH_HOME_URL,
      "user-agent": TWITCH_BROWSER_USER_AGENT,
    };
    if (webContext.cookieHeader) {
      headers.cookie = webContext.cookieHeader;
    }

    const response = await fetch(TWITCH_GQL_INTEGRITY_ENDPOINT, {
      method: "POST",
      headers,
      body: "{}",
    });
    if (!response.ok) {
      return undefined;
    }

    const text = await response.text();
    const parsed = parseJson<Record<string, unknown>>(text, "TWITCH_REQUEST_FAILED");
    return readString(parsed.token);
  }

  private async ensureTwitchBrowserAuthenticated(page: PlaywrightPage): Promise<void> {
    await page.waitForTimeout(500);
    await this.throwIfTwitchBrowserUnauthenticated(page);
  }

  private async throwIfTwitchBrowserUnauthenticated(page: PlaywrightPage): Promise<void> {
    const currentUrl = page.url();
    if (/\/login|\/signup|passport/i.test(currentUrl)) {
      throw new MikaCliError(
        "TWITCH_BROWSER_LOGIN_REQUIRED",
        "Twitch write actions need the shared MikaCLI browser profile to already be logged into twitch.tv. Run `mikacli login --browser` first.",
        {
          details: {
            url: currentUrl,
          },
        },
      );
    }

    const unauthenticated = await firstVisibleTwitchLocator(page, [
      'button[data-a-target="login-button"]',
      'button[data-a-target="signup-button"]',
      'button:has-text("Log In")',
      'button:has-text("Sign Up")',
      '[data-a-target="passport-modal"] button:has-text("Log In")',
    ], 1_500).catch(() => null);
    if (unauthenticated) {
      throw new MikaCliError(
        "TWITCH_BROWSER_LOGIN_REQUIRED",
        "Twitch write actions need the shared MikaCLI browser profile to already be logged into twitch.tv. Run `mikacli login --browser` first.",
        {
          details: {
            url: currentUrl,
          },
        },
      );
    }
  }

  private async waitForTwitchGraphQlOperation(
    page: PlaywrightPage,
    operationName: string,
    timeoutMs: number,
  ): Promise<PlaywrightResponse | null> {
    return page
      .waitForResponse((response) => {
        if (!response.url().includes(TWITCH_GQL_ENDPOINT) || response.request().method().toUpperCase() !== "POST") {
          return false;
        }

        const postData = response.request().postData() ?? "";
        return postData.includes(operationName);
      }, { timeout: timeoutMs })
      .catch(() => null);
  }

  private async waitForTwitchFollowButton(
    page: PlaywrightPage,
    action: "follow" | "unfollow",
  ): Promise<PlaywrightLocator> {
    return firstVisibleTwitchLocator(
      page,
      action === "follow"
        ? [
            'button[data-a-target="follow-button"]',
            'button:has-text("Follow")',
          ]
        : [
            'button[data-a-target="unfollow-button"]',
            'button:has-text("Following")',
            'button:has-text("Unfollow")',
          ],
      15_000,
    );
  }

  private async assertTwitchBrowserMutationSucceeded(
    response: PlaywrightResponse,
    operationName: string,
  ): Promise<void> {
    if (!response.ok()) {
      throw new MikaCliError("TWITCH_BROWSER_ACTION_FAILED", "Twitch rejected the browser-backed GraphQL request.", {
        details: {
          operationName,
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        },
      });
    }

    const parsed = await response.json().catch(() => null) as unknown;
    const record = firstTwitchGraphQlEnvelope(parsed);
    if (!record) {
      throw new MikaCliError("TWITCH_BROWSER_ACTION_FAILED", "Twitch returned an unreadable browser-backed mutation response.", {
        details: {
          operationName,
          url: response.url(),
        },
      });
    }

    const errors = readArray(record.errors)
      .map((entry) => asRecord(entry))
      .filter(Boolean) as Array<Record<string, unknown>>;
    if (errors.length > 0) {
      if (hasTwitchIntegrityChallenge(errors)) {
        throw new MikaCliError("TWITCH_INTEGRITY_REQUIRED", "Twitch blocked the browser-backed write behind an integrity challenge.", {
          details: {
            operationName,
            errors,
          },
        });
      }

      throw new MikaCliError(
        "TWITCH_BROWSER_ACTION_FAILED",
        readString(errors[0]?.message) ?? "Twitch returned a browser-backed mutation error.",
        {
          details: {
            operationName,
            errors,
          },
        },
      );
    }
  }

  private async confirmTwitchBrowserUnfollow(page: PlaywrightPage): Promise<void> {
    const confirmButton = await firstVisibleTwitchLocator(page, [
      'button[data-a-target="modal-primary-button"]',
      'button:has-text("Yes, unfollow")',
      '[role="dialog"] button:has-text("Unfollow")',
    ], 5_000).catch(() => null);
    if (!confirmButton) {
      return;
    }

    await confirmButton.click();
    await page.waitForTimeout(500);
  }

  private async waitForTwitchClipButton(page: PlaywrightPage): Promise<PlaywrightLocator> {
    return firstVisibleTwitchLocator(page, [
      'button[data-a-target="clip-button"]',
      'button[aria-label="Clip"]',
      'button:has-text("Clip")',
    ], 15_000);
  }

  private async waitForTwitchClipCreateResponse(
    page: PlaywrightPage,
    timeoutMs: number,
  ): Promise<PlaywrightResponse | null> {
    return page
      .waitForResponse((response) => {
        if (!response.url().includes(TWITCH_GQL_ENDPOINT) || response.request().method().toUpperCase() !== "POST") {
          return false;
        }

        const postData = (response.request().postData() ?? "").toLowerCase();
        return postData.includes("saveclip") || postData.includes("createclip") || postData.includes("\"clip\"");
      }, { timeout: timeoutMs })
      .catch(() => null);
  }

  private async tryConfirmTwitchClipSave(page: PlaywrightPage): Promise<void> {
    const saveButton = await firstVisibleTwitchLocator(page, [
      'button[data-a-target="clip-editor-save-button"]',
      'button:has-text("Publish")',
      'button:has-text("Save Clip")',
      'button:has-text("Save")',
      'button:has-text("Create Clip")',
    ], 8_000).catch(() => null);
    if (!saveButton) {
      return;
    }

    await saveButton.click().catch(() => undefined);
  }

  private async resolveTwitchClipUrlFromPage(page: PlaywrightPage): Promise<string | undefined> {
    await page.waitForTimeout(1_000);
    for (const selector of [
      'a[href*="clips.twitch.tv/"]',
      'a[href*="/clip/"]',
      'input[value*="clips.twitch.tv/"]',
      'input[value*="/clip/"]',
    ]) {
      const locator = page.locator(selector).first();
      if (!(await isTwitchLocatorVisible(locator))) {
        continue;
      }

      const href = await locator.getAttribute("href").catch(() => null);
      const inputValue = "inputValue" in locator ? await locator.inputValue().catch(() => "") : "";
      const candidate = href ?? inputValue;
      const normalized = normalizeMaybeRelativeTwitchUrl(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return undefined;
  }

  private async fillTwitchDashboardTextInput(
    page: PlaywrightPage,
    labelPatterns: ReadonlyArray<string | RegExp>,
    value: string,
  ): Promise<void> {
    const field = await findTwitchControlByRoles(page, labelPatterns, ["textbox"], 15_000, "text field");
    await field.click();
    await field.fill("");
    await field.fill(value);
  }

  private async fillTwitchDashboardComboBox(
    page: PlaywrightPage,
    labelPatterns: ReadonlyArray<string | RegExp>,
    value: string,
  ): Promise<void> {
    const control = await findTwitchControlByRoles(page, labelPatterns, ["combobox", "textbox"], 15_000, "combobox");
    await control.click();

    const embeddedInput = control.locator("input").first();
    if (await isTwitchLocatorVisible(embeddedInput)) {
      await embeddedInput.fill("");
      await embeddedInput.fill(value);
    } else {
      await page.keyboard.press("Meta+A").catch(() => undefined);
      await page.keyboard.press("Control+A").catch(() => undefined);
      await page.keyboard.type(value);
    }

    await page.waitForTimeout(800);
    await page.keyboard.press("ArrowDown").catch(() => undefined);
    await page.keyboard.press("Enter").catch(() => undefined);
    await page.waitForTimeout(800);
  }

  private async updateTwitchDashboardTags(
    page: PlaywrightPage,
    tags: readonly string[],
    clearExisting: boolean,
  ): Promise<void> {
    const control = await findTwitchControlByRoles(page, [/tags?/i], ["combobox", "textbox"], 15_000, "tags");
    const container = control.locator("xpath=ancestor::*[self::div or self::section][1]").first();

    if (clearExisting) {
      const removeButtons = container.locator('button[aria-label*="remove" i], button[title*="remove" i], button:has-text("Remove")');
      const removeCount = Math.min(await removeButtons.count().catch(() => 0), 25);
      for (let index = 0; index < removeCount; index += 1) {
        const button = removeButtons.nth(0);
        if (!(await isTwitchLocatorVisible(button))) {
          break;
        }

        await button.click().catch(() => undefined);
        await page.waitForTimeout(200);
      }
    }

    for (const tag of tags) {
      await control.click();
      const embeddedInput = control.locator("input").first();
      if (await isTwitchLocatorVisible(embeddedInput)) {
        await embeddedInput.fill(tag);
      } else {
        await page.keyboard.type(tag);
      }
      await page.waitForTimeout(400);
      await page.keyboard.press("Enter").catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }

  private async setTwitchDashboardCheckbox(
    page: PlaywrightPage,
    labelPatterns: ReadonlyArray<string | RegExp>,
    checked: boolean,
  ): Promise<void> {
    const control = await findTwitchControlByRoles(page, labelPatterns, ["checkbox"], 15_000, "checkbox");
    const current = await readTwitchCheckboxState(control);
    if (current === checked) {
      return;
    }

    await control.click();
  }

  private async waitForTwitchSaveButton(page: PlaywrightPage): Promise<PlaywrightLocator> {
    return firstVisibleTwitchLocator(page, [
      'button:has-text("Save")',
      '[role="button"]:has-text("Save")',
    ], 15_000);
  }

  private async waitForAnyTwitchSettingsMutation(
    page: PlaywrightPage,
    timeoutMs: number,
  ): Promise<PlaywrightResponse | null> {
    return page
      .waitForResponse((response) => {
        if (!response.url().includes(TWITCH_GQL_ENDPOINT)) {
          return false;
        }

        return response.request().method().toUpperCase() === "POST";
      }, { timeout: timeoutMs })
      .catch(() => null);
  }

  private async probeImportedSession(jar: CookieJar): Promise<TwitchProbe> {
    const accessToken = await this.extractCookieValue(jar, "auth-token");
    if (!accessToken) {
      throw new MikaCliError("TWITCH_AUTH_TOKEN_MISSING", "Expected the Twitch cookie export to include auth-token.", {
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
      if (error instanceof MikaCliError && error.code === "TWITCH_VALIDATE_FAILED") {
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
      throw new MikaCliError("TWITCH_AUTH_TOKEN_MISSING", "The saved Twitch session no longer contains auth-token.", {
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
        "user-agent": "MikaCLI/1.0",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("TWITCH_VALIDATE_FAILED", "Twitch rejected the saved session during token validation.", {
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
      throw new MikaCliError(code, "Twitch rejected the GraphQL request.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 1000),
        },
      });
    }

    const parsed = parseJson<unknown>(text, "TWITCH_REQUEST_FAILED");
    if (!Array.isArray(parsed)) {
      throw new MikaCliError("TWITCH_RESPONSE_INVALID", "Twitch returned an unexpected GraphQL response shape.");
    }

    return parsed.map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        throw new MikaCliError("TWITCH_RESPONSE_INVALID", "Twitch returned an unexpected GraphQL response item.", {
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
        throw new MikaCliError(firstMessage.toLowerCase().includes("oauth") ? "SESSION_EXPIRED" : "TWITCH_REQUEST_FAILED", firstMessage, {
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
      throw new MikaCliError("TWITCH_PERIOD_INVALID", "Expected --period to be all-time, last-week, or last-day.", {
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
    throw new MikaCliError(code, "Failed to parse the Twitch response.", {
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

function firstTwitchGraphQlEnvelope(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    return asRecord(value[0]);
  }

  return asRecord(value);
}

function hasTwitchIntegrityChallenge(errors: ReadonlyArray<Record<string, unknown>>): boolean {
  return errors.some((error) => {
    const message = readString(error.message)?.toLowerCase() ?? "";
    const challengeType = readString(readPath(error, "extensions", "challenge", "type"))?.toLowerCase();
    return message.includes("integrity") || challengeType === "integrity";
  });
}

function serializeTwitchCookieHeader(session: PlatformSession): string | undefined {
  const cookies = readArray(session.cookieJar?.cookies)
    .map((entry) => asRecord(entry))
    .filter(Boolean) as Array<Record<string, unknown>>;
  const serialized = cookies
    .map((cookie) => {
      const key = readString(cookie.key) ?? readString(cookie.name);
      const value = typeof cookie.value === "string" ? cookie.value : undefined;
      return key && value !== undefined ? `${key}=${value}` : undefined;
    })
    .filter((entry): entry is string => Boolean(entry));

  return serialized.length > 0 ? serialized.join("; ") : undefined;
}

function readSerializedSessionCookieValue(session: PlatformSession, key: string): string | undefined {
  const cookies = readArray(session.cookieJar?.cookies)
    .map((entry) => asRecord(entry))
    .filter(Boolean) as Array<Record<string, unknown>>;
  const match = cookies.find((cookie) => {
    const cookieKey = readString(cookie.key) ?? readString(cookie.name);
    return cookieKey === key;
  });
  return typeof match?.value === "string" && match.value.length > 0 ? match.value : undefined;
}

function randomTwitchIdentifier(length: number): string {
  let output = "";
  while (output.length < length) {
    output += randomUUID().replace(/-/g, "");
  }
  return output.slice(0, length);
}

async function firstVisibleTwitchLocator(
  root: PlaywrightPage | PlaywrightLocator,
  selectors: readonly string[],
  timeoutMs = 10_000,
): Promise<PlaywrightLocator> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = root.locator(selector).first();
      if (await isTwitchLocatorVisible(locator)) {
        return locator;
      }
    }

    if ("waitForTimeout" in root) {
      await root.waitForTimeout(250);
    }
  }

  throw new MikaCliError("TWITCH_BROWSER_TARGET_NOT_FOUND", "Could not find the requested Twitch control in the browser flow.", {
    details: {
      selectors,
    },
  });
}

async function findTwitchControlByRoles(
  page: PlaywrightPage,
  patterns: ReadonlyArray<string | RegExp>,
  roles: ReadonlyArray<"button" | "textbox" | "combobox" | "checkbox" | "link">,
  timeoutMs: number,
  description: string,
): Promise<PlaywrightLocator> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const pattern of patterns) {
      const labeled = page.getByLabel(pattern).first();
      if (await isTwitchLocatorVisible(labeled)) {
        return labeled;
      }

      for (const role of roles) {
        const locator = page.getByRole(role, { name: pattern }).first();
        if (await isTwitchLocatorVisible(locator)) {
          return locator;
        }
      }
    }

    await page.waitForTimeout(250);
  }

  throw new MikaCliError("TWITCH_BROWSER_TARGET_NOT_FOUND", `Could not find the Twitch ${description} in the shared browser flow.`);
}

async function isTwitchLocatorVisible(locator: PlaywrightLocator): Promise<boolean> {
  try {
    if (await locator.count() < 1) {
      return false;
    }

    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function readTwitchCheckboxState(locator: PlaywrightLocator): Promise<boolean | undefined> {
  try {
    return await locator.isChecked();
  } catch {
    const ariaChecked = await locator.getAttribute("aria-checked").catch(() => null);
    if (ariaChecked === "true") {
      return true;
    }
    if (ariaChecked === "false") {
      return false;
    }
    return undefined;
  }
}

function findFirstString(
  value: unknown,
  preferredKeys: readonly string[],
  seen: Set<unknown> = new Set(),
): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findFirstString(entry, preferredKeys, seen);
      if (nested) {
        return nested;
      }
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of preferredKeys) {
    const direct = readString(record[key]);
    if (direct) {
      return direct;
    }
  }

  for (const entry of Object.values(record)) {
    const nested = findFirstString(entry, preferredKeys, seen);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function normalizeMaybeRelativeTwitchUrl(value: string | null | undefined): string | undefined {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) {
    return undefined;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  if (candidate.startsWith("/")) {
    return `${TWITCH_HOME_URL.replace(/\/$/, "")}${candidate}`;
  }

  return undefined;
}

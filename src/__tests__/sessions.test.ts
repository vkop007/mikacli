import { afterEach, describe, expect, test } from "bun:test";

import {
  buildSessionRecommendations,
  listSessionEntries,
  loadSessionEntry,
  repairSessionEntries,
  summarizeSessionEntries,
  summarizeRepairedSessionEntries,
  summarizeValidatedSessionEntries,
  validateSessionEntries,
} from "../commands/sessions.js";
import { getPlatformDefinition } from "../platforms/index.js";

import type { ConnectionRecord } from "../core/auth/auth-types.js";
import type { AdapterStatusResult } from "../types.js";

const originalGithubAdapter = getPlatformDefinition("github")?.adapter;
const originalDiscordbotAdapter = getPlatformDefinition("discordbot")?.adapter;
const originalXAdapter = getPlatformDefinition("x")?.adapter;
const originalTelegramAdapter = getPlatformDefinition("telegram")?.adapter;

afterEach(() => {
  const github = getPlatformDefinition("github");
  if (github) {
    github.adapter = originalGithubAdapter;
  }

  const discordbot = getPlatformDefinition("discordbot");
  if (discordbot) {
    discordbot.adapter = originalDiscordbotAdapter;
  }

  const x = getPlatformDefinition("x");
  if (x) {
    x.adapter = originalXAdapter;
  }

  const telegram = getPlatformDefinition("telegram");
  if (telegram) {
    telegram.adapter = originalTelegramAdapter;
  }
});

describe("sessions command helpers", () => {
  test("maps saved connections into session entries", async () => {
    const fakeStore = {
      async listConnections() {
        return [
          {
            connection: {
              version: 1 as const,
              platform: "github" as const,
              account: "work",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
              auth: {
                kind: "apiKey" as const,
                provider: "github",
                token: "secret",
              },
              status: {
                state: "active" as const,
                message: "GitHub token validated.",
                lastValidatedAt: "2026-01-02T00:00:00.000Z",
              },
              user: {
                username: "vk",
              },
              metadata: {
                bearerToken: "secret-token",
                auth: {
                  team: "Acme",
                  Authorization: "Bearer secret-token",
                },
                autoRefresh: {
                  importantCookiesPresent: ["auth_token", "ct0"],
                },
              },
            },
            path: "/tmp/github-work.json",
          },
        ];
      },
    };

    const entries = await listSessionEntries(fakeStore as never);
    expect(entries).toEqual([
      {
        platform: "github",
        displayName: "GitHub",
        account: "work",
        auth: "apiKey",
        source: "github",
        status: "active",
        message: "GitHub token validated.",
        user: "vk",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        lastValidatedAt: "2026-01-02T00:00:00.000Z",
        path: "/tmp/github-work.json",
        metadata: {
          bearerToken: "[redacted]",
          auth: {
            team: "Acme",
            Authorization: "[redacted]",
          },
          autoRefresh: {
            importantCookiesPresent: ["auth_token", "ct0"],
          },
        },
      },
    ]);
  });

  test("loads a single saved record", async () => {
    const fakeStore = {
      async loadConnection() {
        return {
          connection: {
            version: 1 as const,
            platform: "x" as const,
            account: "default",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            auth: {
              kind: "cookies" as const,
              source: "cookie_json" as const,
            },
            status: {
              state: "expired" as const,
              message: "Session expired.",
            },
          },
          path: "/tmp/x-default.json",
        };
      },
    };

    const entry = await loadSessionEntry("x", "default", fakeStore as never);
    expect(entry.platform).toBe("x");
    expect(entry.auth).toBe("cookies");
    expect(entry.source).toBe("cookie_json");
    expect(entry.status).toBe("expired");
    expect(entry.path).toBe("/tmp/x-default.json");
  });

  test("summarizes saved records and suggests next steps", () => {
    const summary = summarizeSessionEntries([
      {
        platform: "github",
        displayName: "GitHub",
        account: "work",
        auth: "cookies",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        path: "/tmp/github.json",
      },
      {
        platform: "x",
        displayName: "X",
        account: "default",
        auth: "cookies",
        status: "expired",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        path: "/tmp/x.json",
      },
      {
        platform: "telegram",
        displayName: "Telegram",
        account: "default",
        auth: "session",
        status: "unknown",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        path: "/tmp/telegram.json",
      },
    ]);

    expect(summary).toEqual({
      total: 3,
      active: 1,
      expired: 1,
      unknown: 1,
      byAuth: {
        cookies: 2,
        apiKey: 0,
        botToken: 0,
        session: 1,
        oauth2: 0,
        none: 0,
      },
    });
    expect(buildSessionRecommendations(summary)).toEqual([
      "Run `autocli sessions validate` to confirm expired records live, then refresh them with the provider's `login` command.",
      "Run `autocli sessions validate` to replace unknown saved state with a live provider check.",
    ]);
  });

  test("validates saved records live and persists the refreshed status", async () => {
    const github = getPlatformDefinition("github");
    expect(github).toBeDefined();
    github!.adapter = {
      async getStatus(account?: string): Promise<AdapterStatusResult> {
        return {
          platform: "github",
          account: account ?? "default",
          sessionPath: "/tmp/github/default.json",
          connected: false,
          status: "expired",
          message: "GitHub session expired.",
          user: { username: "octocat" },
          lastValidatedAt: "2026-04-10T12:00:00.000Z",
        };
      },
    };

    const saved: ConnectionRecord[] = [];
    const entries = await validateSessionEntries({
      platform: "github",
      connectionStore: {
        async listConnections() {
          return [createConnectionEntry()];
        },
        async saveConnection(connection: ConnectionRecord) {
          saved.push(connection);
          return "/tmp/connections/github/default.json";
        },
      } as never,
    });

    expect(entries).toEqual([
      expect.objectContaining({
        platform: "github",
        account: "default",
        status: "expired",
        basis: "live",
        connected: false,
        path: "/tmp/connections/github/default.json",
        next: "autocli developer github login",
      }),
    ]);
    expect(saved).toEqual([
      expect.objectContaining({
        updatedAt: "2026-04-10T12:00:00.000Z",
        status: expect.objectContaining({
          state: "expired",
          message: "GitHub session expired.",
          lastValidatedAt: "2026-04-10T12:00:00.000Z",
        }),
      }),
    ]);
    expect(summarizeValidatedSessionEntries(entries)).toEqual({
      total: 1,
      active: 0,
      expired: 1,
      unknown: 0,
      live: 1,
      refreshFailed: 0,
      updated: 1,
    });
  });

  test("keeps stored state when live validation fails and suggests relogin for expired accounts", async () => {
    const github = getPlatformDefinition("github");
    expect(github).toBeDefined();
    github!.adapter = {
      async getStatus(): Promise<AdapterStatusResult> {
        throw new Error("network down");
      },
    };

    let saveCalled = false;
    const entries = await validateSessionEntries({
      platform: "github",
      connectionStore: {
        async listConnections() {
          const entry = createConnectionEntry();
          entry.connection.status.state = "expired";
          entry.connection.status.message = "Saved GitHub session expired.";
          return [entry];
        },
        async saveConnection() {
          saveCalled = true;
          return "/tmp/should-not-write.json";
        },
      } as never,
    });

    expect(entries).toEqual([
      expect.objectContaining({
        platform: "github",
        account: "default",
        status: "expired",
        basis: "refresh-failed",
        next: "autocli developer github login",
        refreshError: "network down",
      }),
    ]);
    expect(entries[0]?.message).toContain("Live refresh failed: network down");
    expect(saveCalled).toBeFalse();
  });

  test("replays stored bot tokens during automatic repair", async () => {
    const discordbot = getPlatformDefinition("discordbot");
    expect(discordbot).toBeDefined();
    const loginInputs: Array<Record<string, unknown>> = [];
    discordbot!.adapter = {
      async getStatus(): Promise<AdapterStatusResult> {
        throw new Error("token expired");
      },
      async login(input: Record<string, unknown>) {
        loginInputs.push(input);
        return {
          ok: true,
          platform: "discordbot",
          account: "default",
          action: "login",
          message: "Saved Discord bot token again.",
          sessionPath: "/tmp/discordbot/default.json",
        };
      },
    };

    const entries = await repairSessionEntries({
      platform: "discordbot",
      connectionStore: {
        async listConnections() {
          return [
            createConnectionEntry({
              platform: "discordbot",
              auth: {
                kind: "botToken",
                provider: "discord",
                token: "discord-bot-token-example",
              },
              status: {
                state: "expired",
                message: "Token expired.",
              },
            }),
          ];
        },
        async saveConnection(connection: ConnectionRecord) {
          return "/tmp/discordbot/default.json";
        },
        async loadConnection() {
          return {
            path: "/tmp/discordbot/default.json",
            connection: createConnectionEntry({
              platform: "discordbot",
              auth: {
                kind: "botToken",
                provider: "discord",
                token: "discord-bot-token-example",
              },
              status: {
                state: "active",
                message: "Bot token active.",
                lastValidatedAt: "2026-04-10T15:00:00.000Z",
              },
            }).connection,
          };
        },
      } as never,
    });

    expect(loginInputs).toEqual([
      {
        account: "default",
        token: "discord-bot-token-example",
      },
    ]);
    expect(entries).toEqual([
      expect.objectContaining({
        platform: "discordbot",
        outcome: "repaired",
        status: "active",
        repairAction: "token-replay",
        message: "Saved Discord bot token again.",
      }),
    ]);
    expect(summarizeRepairedSessionEntries(entries)).toEqual({
      total: 1,
      healthy: 0,
      repaired: 1,
      manual: 0,
      failed: 0,
      active: 1,
      expired: 0,
      unknown: 0,
    });
  });

  test("marks cookie-backed repairs as manual unless --browser is enabled", async () => {
    const x = getPlatformDefinition("x");
    expect(x).toBeDefined();
    let loginCalled = false;
    x!.adapter = {
      async getStatus(): Promise<AdapterStatusResult> {
        throw new Error("session expired");
      },
      async login() {
        loginCalled = true;
        throw new Error("should not be called");
      },
    };

    const entries = await repairSessionEntries({
      platform: "x",
      connectionStore: {
        async listConnections() {
          return [
            createConnectionEntry({
              platform: "x",
              auth: {
                kind: "cookies",
                source: "cookie_json",
              },
              status: {
                state: "expired",
                message: "Saved X session expired.",
              },
            }),
          ];
        },
        async saveConnection(connection: ConnectionRecord) {
          return "/tmp/x/default.json";
        },
        async loadConnection() {
          throw new Error("should not load repaired session");
        },
      } as never,
    });

    expect(loginCalled).toBeFalse();
    expect(entries).toEqual([
      expect.objectContaining({
        platform: "x",
        outcome: "manual",
        status: "expired",
        repairAction: "browser-login",
        next: "autocli social x login",
      }),
    ]);
    expect(entries[0]?.message).toContain("--browser");
  });

  test("uses browser-backed login when cookie repair is requested with --browser", async () => {
    const x = getPlatformDefinition("x");
    expect(x).toBeDefined();
    const loginInputs: Array<Record<string, unknown>> = [];
    x!.adapter = {
      async getStatus(): Promise<AdapterStatusResult> {
        throw new Error("session expired");
      },
      async login(input: Record<string, unknown>) {
        loginInputs.push(input);
        return {
          ok: true,
          platform: "x",
          account: "default",
          action: "login",
          message: "Saved X session again.",
          sessionPath: "/tmp/x/default.json",
        };
      },
    };

    const entries = await repairSessionEntries({
      platform: "x",
      browser: true,
      browserTimeoutSeconds: 120,
      connectionStore: {
        async listConnections() {
          return [
            createConnectionEntry({
              platform: "x",
              auth: {
                kind: "cookies",
                source: "cookie_json",
              },
              status: {
                state: "expired",
                message: "Saved X session expired.",
              },
            }),
          ];
        },
        async saveConnection(connection: ConnectionRecord) {
          return "/tmp/x/default.json";
        },
        async loadConnection() {
          return {
            path: "/tmp/x/default.json",
            connection: createConnectionEntry({
              platform: "x",
              auth: {
                kind: "cookies",
                source: "cookie_json",
              },
              status: {
                state: "active",
                message: "X session active.",
              },
            }).connection,
          };
        },
      } as never,
    });

    expect(loginInputs).toEqual([
      {
        account: "default",
        browser: true,
        browserTimeoutSeconds: 120,
      },
    ]);
    expect(entries).toEqual([
      expect.objectContaining({
        platform: "x",
        outcome: "repaired",
        status: "active",
        repairAction: "browser-login",
      }),
    ]);
  });

  test("replays stored telegram session metadata during session repair", async () => {
    const telegram = getPlatformDefinition("telegram");
    expect(telegram).toBeDefined();
    const loginInputs: Array<Record<string, unknown>> = [];
    telegram!.adapter = {
      async getStatus(): Promise<AdapterStatusResult> {
        throw new Error("telegram session expired");
      },
      async login(input: Record<string, unknown>) {
        loginInputs.push(input);
        return {
          ok: true,
          platform: "telegram",
          account: "default",
          action: "login",
          message: "Telegram session imported.",
          sessionPath: "/tmp/telegram/default.json",
        };
      },
    };

    const entries = await repairSessionEntries({
      platform: "telegram",
      connectionStore: {
        async listConnections() {
          return [
            createConnectionEntry({
              platform: "telegram",
              auth: {
                kind: "session",
                provider: "mtproto",
              },
              status: {
                state: "expired",
                message: "Telegram session expired.",
              },
              metadata: {
                apiId: 123456,
                apiHash: "telegram-api-hash-example",
                sessionString: "telegram-session-example",
              },
            }),
          ];
        },
        async saveConnection(connection: ConnectionRecord) {
          return "/tmp/telegram/default.json";
        },
        async loadConnection() {
          return {
            path: "/tmp/telegram/default.json",
            connection: createConnectionEntry({
              platform: "telegram",
              auth: {
                kind: "session",
                provider: "mtproto",
              },
              status: {
                state: "active",
                message: "Telegram session is active.",
              },
            }).connection,
          };
        },
      } as never,
    });

    expect(loginInputs).toEqual([
      {
        account: "default",
        apiId: 123456,
        apiHash: "telegram-api-hash-example",
        sessionString: "telegram-session-example",
      },
    ]);
    expect(entries).toEqual([
      expect.objectContaining({
        platform: "telegram",
        outcome: "repaired",
        repairAction: "telegram-session-replay",
        status: "active",
      }),
    ]);
  });
});

function createConnectionEntry(input?: {
  platform?: ConnectionRecord["platform"];
  auth?: ConnectionRecord["auth"];
  status?: ConnectionRecord["status"];
  metadata?: ConnectionRecord["metadata"];
}): { connection: ConnectionRecord; path: string } {
  const platform = input?.platform ?? "github";
  return {
    path: `/tmp/${platform}/default.json`,
    connection: {
      version: 1,
      platform,
      account: "default",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
      auth: input?.auth ?? {
        kind: "cookies",
        source: "cookie_json",
      },
      status: input?.status ?? {
        state: "active",
        message: "Saved GitHub web session.",
        lastValidatedAt: "2026-04-10T00:00:00.000Z",
      },
      user: {
        username: "octocat",
      },
      ...(input?.metadata ? { metadata: input.metadata } : {}),
    },
  };
}

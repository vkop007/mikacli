import { describe, expect, test } from "bun:test";

import { MikaCliError } from "../errors.js";
import { logoutSavedState } from "../commands/logout.js";

import type { ConnectionRecord } from "../core/auth/auth-types.js";

describe("logout command helpers", () => {
  test("logs out all saved accounts by default", async () => {
    const removedCalls: Array<{ platform: string; account: string }> = [];

    const result = await logoutSavedState({
      connectionStore: {
        async listConnections() {
          return [
            createListedConnection("x", "default"),
            createListedConnection("github", "work"),
          ];
        },
      } as never,
      removeSessionArtifactsFn: async (platform, account) => {
        removedCalls.push({ platform, account });
        return [
          { kind: "session", path: `/tmp/${platform}/${account}.session.json` },
          { kind: "connection", path: `/tmp/${platform}/${account}.connection.json` },
        ];
      },
    });

    expect(removedCalls).toEqual([
      { platform: "x", account: "default" },
      { platform: "github", account: "work" },
    ]);
    expect(result).toEqual({
      ok: true,
      scope: "all",
      browserCleared: false,
      removedAccounts: 2,
      removedArtifacts: 4,
      removed: [
        { kind: "session", path: "/tmp/x/default.session.json", platform: "x", account: "default" },
        { kind: "connection", path: "/tmp/x/default.connection.json", platform: "x", account: "default" },
        { kind: "session", path: "/tmp/github/work.session.json", platform: "github", account: "work" },
        { kind: "connection", path: "/tmp/github/work.connection.json", platform: "github", account: "work" },
      ],
      message: "Saved provider login state cleared. Removed 2 saved accounts.",
    });
  });

  test("logs out a targeted platform/account only", async () => {
    const removedCalls: Array<{ platform: string; account: string }> = [];

    const result = await logoutSavedState({
      platform: "x",
      account: "default",
      connectionStore: {
        async listConnections() {
          return [
            createListedConnection("x", "default"),
            createListedConnection("github", "work"),
          ];
        },
      } as never,
      removeSessionArtifactsFn: async (platform, account) => {
        removedCalls.push({ platform, account });
        return [{ kind: "session", path: `/tmp/${platform}/${account}.session.json` }];
      },
    });

    expect(removedCalls).toEqual([{ platform: "x", account: "default" }]);
    expect(result.scope).toBe("targeted");
    expect(result.removedAccounts).toBe(1);
    expect(result.message).toBe("Requested saved login state removed. Removed 1 saved account.");
  });

  test("can also clear the shared browser profile", async () => {
    const browserPaths: string[] = [];

    const result = await logoutSavedState({
      browser: true,
      browserProfilePath: "/tmp/mikacli-browser/default",
      connectionStore: {
        async listConnections() {
          return [];
        },
      } as never,
      removeSessionArtifactsFn: async () => [],
      removeBrowserProfileFn: async (path) => {
        browserPaths.push(path);
        return true;
      },
    });

    expect(browserPaths).toEqual(["/tmp/mikacli-browser/default"]);
    expect(result).toEqual({
      ok: true,
      scope: "all",
      browserCleared: true,
      removedAccounts: 0,
      removedArtifacts: 1,
      removed: [{ kind: "browser-profile", path: "/tmp/mikacli-browser/default" }],
      message: "Saved provider login state cleared. No saved provider sessions were present. Shared browser profile cleared too.",
    });
  });

  test("throws when a targeted saved record does not exist", async () => {
    await expect(
      logoutSavedState({
        platform: "linkedin",
        account: "default",
        connectionStore: {
          async listConnections() {
            return [createListedConnection("x", "default")];
          },
        } as never,
      }),
    ).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    } satisfies Partial<MikaCliError>);
  });
});

function createListedConnection(platform: ConnectionRecord["platform"], account: string): {
  connection: ConnectionRecord;
  path: string;
} {
  return {
    path: `/tmp/${platform}/${account}.json`,
    connection: {
      version: 1,
      platform,
      account,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
      auth: {
        kind: "cookies",
        source: "cookie_json",
      },
      status: {
        state: "active",
      },
    },
  };
}

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PlatformStateStore,
  assertPlatformRunnable,
  managePlatform,
} from "../core/platform-state.js";
import { MikaCliError } from "../errors.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("PlatformStateStore", () => {
  test("defaults bundled and newly discovered providers to installed and enabled", async () => {
    const { store } = await createStore();
    expect(await store.get("future-provider")).toEqual({
      platform: "future-provider",
      installed: true,
      enabled: true,
      status: "enabled",
      source: "bundled",
      configured: false,
    });
  });

  test("persists disable, enable, uninstall, and reinstall transitions", async () => {
    const { path, store } = await createStore();
    expect((await store.manage("github", "disable")).status).toBe("disabled");
    expect((await new PlatformStateStore({ path }).get("github")).status).toBe("disabled");
    expect((await store.manage("github", "enable")).status).toBe("enabled");
    expect((await store.manage("github", "uninstall")).status).toBe("uninstalled");
    expect((await store.manage("github", "install")).status).toBe("enabled");

    const raw = JSON.parse(await readFile(path, "utf8")) as { version: number };
    expect(raw.version).toBe(1);
  });

  test("does not allow an uninstalled platform to be enabled or run", async () => {
    const { store } = await createStore();
    await store.manage("github", "uninstall");

    await expect(store.manage("github", "enable")).rejects.toMatchObject({
      code: "PLATFORM_NOT_INSTALLED",
    });
    await expect(assertPlatformRunnable("github", store)).rejects.toMatchObject({
      code: "PLATFORM_NOT_INSTALLED",
    });
  });

  test("preserves auth by default and only clears it when explicitly requested", async () => {
    const { store } = await createStore();
    let clearCalls = 0;
    const clearAuth = async () => {
      clearCalls += 1;
      return ["session", "connection"];
    };

    const preserved = await managePlatform(store, "github", "uninstall", { clearAuth });
    expect(preserved.preserveAuth).toBe(true);
    expect(preserved.removedAuthPaths).toEqual([]);
    expect(clearCalls).toBe(0);

    const removed = await managePlatform(store, "github", "uninstall", {
      preserveAuth: false,
      clearAuth,
    });
    expect(removed.preserveAuth).toBe(false);
    expect(removed.removedAuthPaths).toEqual(["session", "connection"]);
    expect(clearCalls).toBe(1);
  });

  test("retains state for providers that are temporarily absent from the catalog", async () => {
    const { path, store } = await createStore();
    await writeFile(path, JSON.stringify({
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      platforms: {
        removed_then_restored: {
          installed: false,
          enabled: false,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    }));
    await store.manage("github", "disable");

    const raw = JSON.parse(await readFile(path, "utf8")) as {
      platforms: Record<string, unknown>;
    };
    expect(raw.platforms).toHaveProperty("removed_then_restored");
  });

  test("rejects corrupt and unsupported state without overwriting it", async () => {
    const { path, store } = await createStore();
    await writeFile(path, JSON.stringify({ version: 99, updatedAt: "x", platforms: {} }));
    await expect(store.get("github")).rejects.toBeInstanceOf(MikaCliError);
    await expect(store.get("github")).rejects.toMatchObject({
      code: "PLATFORM_STATE_VERSION_UNSUPPORTED",
    });
  });
});

async function createStore(): Promise<{ path: string; store: PlatformStateStore }> {
  const directory = await mkdtemp(join(tmpdir(), "mikacli-platform-state-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "platforms.json");
  return {
    path,
    store: new PlatformStateStore({
      path,
      now: () => new Date("2026-08-13T12:00:00.000Z"),
    }),
  };
}

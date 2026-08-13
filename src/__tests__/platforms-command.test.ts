import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listPlatformCatalog } from "../commands/platforms.js";
import { PlatformStateStore } from "../core/platform-state.js";
import { getPlatformDefinitions } from "../platforms/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("platform catalog command", () => {
  test("reports the entire dynamic registry and its state summary", async () => {
    const store = await createStore();
    const result = await listPlatformCatalog({}, store);
    expect(result.total).toBe(getPlatformDefinitions().length);
    expect(result.summary.enabled).toBe(result.total);
    expect(result.platforms.some((entry) => entry.platform === "github")).toBe(true);
  });

  test("filters by persistent state without removing providers from discovery", async () => {
    const store = await createStore();
    await store.manage("github", "disable");
    await store.manage("linear", "uninstall");

    const disabled = await listPlatformCatalog({ status: "disabled" }, store);
    expect(disabled.platforms.map((entry) => entry.platform)).toEqual(["github"]);
    const uninstalled = await listPlatformCatalog({ status: "uninstalled" }, store);
    expect(uninstalled.platforms.map((entry) => entry.platform)).toEqual(["linear"]);
  });
});

async function createStore(): Promise<PlatformStateStore> {
  const directory = await mkdtemp(join(tmpdir(), "mikacli-platform-command-"));
  temporaryDirectories.push(directory);
  return new PlatformStateStore({ path: join(directory, "platforms.json") });
}

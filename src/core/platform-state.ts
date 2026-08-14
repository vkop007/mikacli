import { access, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";

import {
  PLATFORM_STATE_PATH,
  ensureParentDirectory,
  getPlatformConnectionDir,
  getPlatformSessionDir,
} from "../config.js";
import { MikaCliError } from "../errors.js";
import { PLATFORM_STATE_SCHEMA_VERSION } from "../integration-metadata.js";

import type { PlatformName } from "../platforms/config.js";

export const PLATFORM_MANAGEMENT_ACTIONS = ["install", "enable", "disable", "uninstall"] as const;

export type PlatformManagementAction = (typeof PLATFORM_MANAGEMENT_ACTIONS)[number];
export type PlatformAvailability = "enabled" | "disabled" | "uninstalled";

type PersistedPlatformState = {
  installed: boolean;
  enabled: boolean;
  updatedAt: string;
};

type PlatformStateFile = {
  version: typeof PLATFORM_STATE_SCHEMA_VERSION;
  updatedAt: string;
  platforms: Record<string, PersistedPlatformState>;
};

export type ResolvedPlatformState = {
  platform: string;
  installed: boolean;
  enabled: boolean;
  status: PlatformAvailability;
  source: "bundled";
  configured: boolean;
  updatedAt?: string;
};

export type PlatformManagementResult = {
  ok: true;
  action: PlatformManagementAction;
  platform: string;
  changed: boolean;
  state: ResolvedPlatformState;
  preserveAuth: boolean;
  removedAuthPaths: string[];
};

type PlatformStateStoreOptions = {
  path?: string;
  now?: () => Date;
};

type ManagePlatformOptions = {
  preserveAuth?: boolean;
  clearAuth?: (platform: PlatformName) => Promise<string[]>;
};

export class PlatformStateStore {
  readonly path: string;
  private readonly now: () => Date;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(options: PlatformStateStoreOptions = {}) {
    this.path = options.path ?? PLATFORM_STATE_PATH;
    this.now = options.now ?? (() => new Date());
  }

  async get(platform: string): Promise<ResolvedPlatformState> {
    const file = await this.read();
    return resolvePlatformState(platform, file.platforms[platform]);
  }

  async list(platforms: readonly string[]): Promise<ResolvedPlatformState[]> {
    const file = await this.read();
    return platforms.map((platform) => resolvePlatformState(platform, file.platforms[platform]));
  }

  async manage(platform: string, action: PlatformManagementAction): Promise<ResolvedPlatformState> {
    let result: ResolvedPlatformState | undefined;
    const mutation = this.mutationQueue.then(async () => {
      const file = await this.read();
      const before = resolvePlatformState(platform, file.platforms[platform]);
      const next = transitionPlatformState(before, action);

      if (next.installed === before.installed && next.enabled === before.enabled) {
        result = before;
        return;
      }

      const updatedAt = this.now().toISOString();
      file.platforms[platform] = {
        installed: next.installed,
        enabled: next.enabled,
        updatedAt,
      };
      file.updatedAt = updatedAt;
      await this.write(file);
      result = resolvePlatformState(platform, file.platforms[platform]);
    });

    this.mutationQueue = mutation.catch(() => undefined);
    await mutation;
    return result ?? this.get(platform);
  }

  private async read(): Promise<PlatformStateFile> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return emptyStateFile(this.now().toISOString());
      }
      throw new MikaCliError("PLATFORM_STATE_READ_FAILED", `Could not read platform state at ${this.path}.`, {
        cause: error,
        details: { path: this.path },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw corruptStateError(this.path, "The file is not valid JSON.", error);
    }

    return parseStateFile(parsed, this.path);
  }

  private async write(file: PlatformStateFile): Promise<void> {
    await ensureParentDirectory(this.path);
    const temporaryPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(file, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, this.path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw new MikaCliError("PLATFORM_STATE_WRITE_FAILED", `Could not save platform state at ${this.path}.`, {
        cause: error,
        details: { path: this.path },
      });
    }
  }
}

export function defaultPlatformState(platform: string): ResolvedPlatformState {
  return resolvePlatformState(platform);
}

export async function assertPlatformRunnable(
  platform: string,
  store: PlatformStateStore = new PlatformStateStore(),
): Promise<ResolvedPlatformState> {
  const state = await store.get(platform);
  if (!state.installed) {
    throw new MikaCliError(
      "PLATFORM_NOT_INSTALLED",
      `Platform "${platform}" is not installed. Run "mikacli platforms install ${platform}" first.`,
      { details: { platform, state } },
    );
  }
  if (!state.enabled) {
    throw new MikaCliError(
      "PLATFORM_DISABLED",
      `Platform "${platform}" is disabled. Run "mikacli platforms enable ${platform}" first.`,
      { details: { platform, state } },
    );
  }
  return state;
}

export async function managePlatform(
  store: PlatformStateStore,
  platform: PlatformName,
  action: PlatformManagementAction,
  options: ManagePlatformOptions = {},
): Promise<PlatformManagementResult> {
  const preserveAuth = options.preserveAuth ?? true;
  const before = await store.get(platform);
  const removedAuthPaths = action === "uninstall" && !preserveAuth
    ? await (options.clearAuth ?? clearPlatformAuthState)(platform)
    : [];
  const state = await store.manage(platform, action);

  return {
    ok: true,
    action,
    platform,
    changed: state.installed !== before.installed || state.enabled !== before.enabled,
    state,
    preserveAuth,
    removedAuthPaths,
  };
}

export function summarizePlatformStates(states: readonly ResolvedPlatformState[]): {
  total: number;
  installed: number;
  enabled: number;
  disabled: number;
  uninstalled: number;
} {
  return states.reduce(
    (summary, state) => {
      summary.total += 1;
      if (state.installed) summary.installed += 1;
      if (state.status === "enabled") summary.enabled += 1;
      if (state.status === "disabled") summary.disabled += 1;
      if (state.status === "uninstalled") summary.uninstalled += 1;
      return summary;
    },
    { total: 0, installed: 0, enabled: 0, disabled: 0, uninstalled: 0 },
  );
}

function resolvePlatformState(platform: string, persisted?: PersistedPlatformState): ResolvedPlatformState {
  const installed = persisted?.installed ?? true;
  const enabled = installed && (persisted?.enabled ?? true);
  return {
    platform,
    installed,
    enabled,
    status: !installed ? "uninstalled" : enabled ? "enabled" : "disabled",
    source: "bundled",
    configured: Boolean(persisted),
    ...(persisted ? { updatedAt: persisted.updatedAt } : {}),
  };
}

function transitionPlatformState(
  current: ResolvedPlatformState,
  action: PlatformManagementAction,
): Pick<ResolvedPlatformState, "installed" | "enabled"> {
  switch (action) {
    case "install":
      return { installed: true, enabled: true };
    case "enable":
      if (!current.installed) {
        throw new MikaCliError(
          "PLATFORM_NOT_INSTALLED",
          `Platform "${current.platform}" is not installed. Install it before enabling it.`,
          { details: { platform: current.platform, state: current } },
        );
      }
      return { installed: true, enabled: true };
    case "disable":
      if (!current.installed) {
        throw new MikaCliError(
          "PLATFORM_NOT_INSTALLED",
          `Platform "${current.platform}" is not installed, so it cannot be disabled.`,
          { details: { platform: current.platform, state: current } },
        );
      }
      return { installed: true, enabled: false };
    case "uninstall":
      return { installed: false, enabled: false };
  }
}

async function clearPlatformAuthState(platform: PlatformName): Promise<string[]> {
  const targets = [getPlatformSessionDir(platform), getPlatformConnectionDir(platform)];
  const removed: string[] = [];
  for (const target of targets) {
    if (!(await pathExists(target))) continue;
    await rm(target, { recursive: true, force: true });
    removed.push(target);
  }
  return removed;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function emptyStateFile(updatedAt: string): PlatformStateFile {
  return {
    version: PLATFORM_STATE_SCHEMA_VERSION,
    updatedAt,
    platforms: {},
  };
}

function parseStateFile(value: unknown, path: string): PlatformStateFile {
  if (!isRecord(value)) {
    throw corruptStateError(path, "The root value must be an object.");
  }
  if (value.version !== PLATFORM_STATE_SCHEMA_VERSION) {
    throw new MikaCliError(
      "PLATFORM_STATE_VERSION_UNSUPPORTED",
      `Platform state version ${String(value.version)} is unsupported; expected ${PLATFORM_STATE_SCHEMA_VERSION}.`,
      { details: { path, found: value.version, expected: PLATFORM_STATE_SCHEMA_VERSION } },
    );
  }
  if (typeof value.updatedAt !== "string" || !isRecord(value.platforms)) {
    throw corruptStateError(path, "Required fields are missing.");
  }

  const platforms: Record<string, PersistedPlatformState> = {};
  for (const [platform, state] of Object.entries(value.platforms)) {
    if (
      !isRecord(state)
      || typeof state.installed !== "boolean"
      || typeof state.enabled !== "boolean"
      || typeof state.updatedAt !== "string"
      || (!state.installed && state.enabled)
    ) {
      throw corruptStateError(path, `State for platform "${platform}" is invalid.`);
    }
    platforms[platform] = {
      installed: state.installed,
      enabled: state.enabled,
      updatedAt: state.updatedAt,
    };
  }

  return {
    version: PLATFORM_STATE_SCHEMA_VERSION,
    updatedAt: value.updatedAt,
    platforms,
  };
}

function corruptStateError(path: string, reason: string, cause?: unknown): MikaCliError {
  return new MikaCliError(
    "PLATFORM_STATE_CORRUPT",
    `Platform state at ${path} is invalid. ${reason}`,
    { cause, details: { path, reason } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

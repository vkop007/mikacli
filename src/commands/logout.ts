import { access, rm } from "node:fs/promises";
import { constants } from "node:fs";

import { Command } from "commander";

import { getBrowserProfileDir, sanitizeAccountName } from "../config.js";
import { ConnectionStore } from "../core/auth/connection-store.js";
import { MikaCliError } from "../errors.js";
import { isPlatform } from "../platforms/config.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson } from "../utils/output.js";
import { removeSessionArtifacts } from "./sessions.js";

import type { Platform } from "../types.js";

type LogoutArtifact = {
  kind: "session" | "connection" | "browser-profile";
  path: string;
  platform?: Platform;
  account?: string;
};

type LogoutResult = {
  ok: true;
  scope: "all" | "targeted";
  browserCleared: boolean;
  removedAccounts: number;
  removedArtifacts: number;
  removed: LogoutArtifact[];
  message: string;
};

type LogoutConnectionStore = Pick<ConnectionStore, "listConnections">;

export function createLogoutCommand(): Command {
  return new Command("logout")
    .description("Remove saved provider sessions and optionally clear the shared MikaCLI browser profile")
    .argument("[platform]", "Optional platform id")
    .argument("[account]", "Optional saved account name; defaults to all saved accounts for the platform")
    .option("--all", "Remove all saved provider sessions and token connections (default when no platform is passed)")
    .option("--browser", "Also clear the shared MikaCLI browser profile")
    .addHelpText(
      "after",
      `
Examples:
  mikacli logout
  mikacli logout --all
  mikacli logout --browser
  mikacli logout x
  mikacli logout x default
  mikacli logout x default --browser
`,
    )
    .action(async function logoutAction(this: Command, platform?: string, account?: string) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{ all?: boolean; browser?: boolean }>();
      const result = await logoutSavedState({
        platform,
        account,
        all: Boolean(options.all),
        browser: Boolean(options.browser),
      });

      if (ctx.json) {
        printJson(result);
        return;
      }

      console.log(result.message);
      for (const entry of result.removed) {
        console.log(`${entry.kind}: ${entry.path}`);
      }
    });
}

export async function logoutSavedState(input: {
  platform?: string;
  account?: string;
  all?: boolean;
  browser?: boolean;
  connectionStore?: LogoutConnectionStore;
  removeSessionArtifactsFn?: typeof removeSessionArtifacts;
  browserProfilePath?: string;
  removeBrowserProfileFn?: (path: string) => Promise<boolean>;
}): Promise<LogoutResult> {
  const connectionStore = input.connectionStore ?? new ConnectionStore();
  const removeSessionArtifactsFn = input.removeSessionArtifactsFn ?? removeSessionArtifacts;
  const removeBrowserProfileFn = input.removeBrowserProfileFn ?? removeBrowserProfile;
  const platform = input.platform ? requirePlatform(input.platform) : undefined;
  const account = input.account ? sanitizeAccountName(input.account) : undefined;
  const removeAllSaved = Boolean(input.all) || (!platform && !account);
  const connections = await connectionStore.listConnections();
  const targets = connections.filter((entry) => {
    if (platform && entry.connection.platform !== platform) {
      return false;
    }

    if (account && entry.connection.account !== account) {
      return false;
    }

    return true;
  });

  if (!removeAllSaved && targets.length === 0) {
    throw new MikaCliError(
      "SESSION_NOT_FOUND",
      account
        ? `No saved ${platform ?? "provider"} record found for account "${account}".`
        : `No saved records found for ${platform}.`,
      {
        details: {
          ...(platform ? { platform } : {}),
          ...(account ? { account } : {}),
        },
      },
    );
  }

  const removed: LogoutArtifact[] = [];

  const removalTargets = removeAllSaved ? connections : targets;
  for (const entry of removalTargets) {
    const artifacts = await removeSessionArtifactsFn(entry.connection.platform, entry.connection.account);
    removed.push(...artifacts.map((artifact) => ({
      ...artifact,
      platform: entry.connection.platform,
      account: entry.connection.account,
    })));
  }

  let browserCleared = false;
  if (input.browser) {
    const browserProfilePath = input.browserProfilePath ?? getBrowserProfileDir();
    browserCleared = await removeBrowserProfileFn(browserProfilePath);
    if (browserCleared) {
      removed.push({
        kind: "browser-profile",
        path: browserProfilePath,
      });
    }
  }

  return {
    ok: true,
    scope: removeAllSaved ? "all" : "targeted",
    browserCleared,
    removedAccounts: uniqueRemovedAccounts(removed),
    removedArtifacts: removed.length,
    removed,
    message: buildLogoutMessage({
      removedAccounts: uniqueRemovedAccounts(removed),
      removedArtifacts: removed.length,
      browserCleared,
      targeted: !removeAllSaved,
      browserRequested: Boolean(input.browser),
      hadSavedTargets: removalTargets.length > 0,
    }),
  };
}

function uniqueRemovedAccounts(removed: readonly LogoutArtifact[]): number {
  return new Set(
    removed
      .map((entry) => (entry.platform && entry.account ? `${entry.platform}:${entry.account}` : undefined))
      .filter((value): value is string => typeof value === "string"),
  ).size;
}

function buildLogoutMessage(input: {
  removedAccounts: number;
  removedArtifacts: number;
  browserCleared: boolean;
  targeted: boolean;
  browserRequested: boolean;
  hadSavedTargets: boolean;
}): string {
  if (input.removedArtifacts === 0) {
    return input.browserRequested
      ? "No saved provider sessions were removed, and no shared browser profile was present to clear."
      : "No saved provider sessions were present to remove.";
  }

  const scope = input.targeted ? "Requested saved login state removed." : "Saved provider login state cleared.";
  const accountText = input.removedAccounts > 0
    ? ` Removed ${input.removedAccounts} saved account${input.removedAccounts === 1 ? "" : "s"}.`
    : input.hadSavedTargets
      ? ""
      : " No saved provider sessions were present.";
  const browserText = input.browserCleared ? " Shared browser profile cleared too." : "";
  return `${scope}${accountText}${browserText}`.trim();
}

async function removeBrowserProfile(path: string): Promise<boolean> {
  if (!(await fileExists(path))) {
    return false;
  }

  await rm(path, { force: true, recursive: true });
  return true;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function requirePlatform(value: string): Platform {
  if (!isPlatform(value)) {
    throw new MikaCliError("INVALID_PLATFORM", `Unknown platform "${value}".`, {
      details: {
        platform: value,
      },
    });
  }

  return value;
}

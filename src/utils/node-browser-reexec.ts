import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { ensureCacheDirectory, getCachePath } from "../config.js";
import { MikaCliError } from "../errors.js";

export const BROWSER_NODE_REEXEC_ERROR_CODE = "BROWSER_NODE_REEXEC_REQUIRED";

export function isBrowserNodeReexecRequired(error: unknown): boolean {
  return error instanceof MikaCliError && error.code === BROWSER_NODE_REEXEC_ERROR_CODE;
}

export function resolveNodeCliEntrypoint(moduleUrl: string): string {
  return fileURLToPath(new URL("../dist/index.js", moduleUrl));
}

export function buildNodeBrowserReexecArgs(entrypoint: string, argv: readonly string[], localStorageFile: string): string[] {
  return [`--localstorage-file=${localStorageFile}`, entrypoint, ...argv.slice(2)];
}

export async function reexecBrowserCommandInNode(moduleUrl: string, argv: readonly string[]): Promise<number> {
  if (!process.versions.bun) {
    throw new MikaCliError("NODE_REEXEC_UNNEEDED", "Browser runtime re-exec is only needed when MikaCLI is running under Bun.");
  }

  const entrypoint = resolveNodeCliEntrypoint(moduleUrl);
  await ensureNodeEntrypointExists(moduleUrl, entrypoint);
  await ensureCacheDirectory();
  const localStorageFile = getCachePath("node-localstorage.json");

  return spawnAndWait(
    process.env.MIKACLI_NODE_PATH?.trim() || "node",
    buildNodeBrowserReexecArgs(entrypoint, argv, localStorageFile),
    {
    stdio: "inherit",
    env: {
      ...process.env,
      MIKACLI_NODE_BROWSER_REEXEC: "1",
    },
  });
}

async function ensureNodeEntrypointExists(moduleUrl: string, entrypoint: string): Promise<void> {
  try {
    await access(entrypoint, constants.R_OK);
    return;
  } catch {
    // Build below.
  }

  const projectRoot = fileURLToPath(new URL("../", moduleUrl));
  await spawnAndWait(process.execPath, [
    "build",
    "--target=node",
    "--format=esm",
    "--external",
    "tlsclientwrapper",
    "--external",
    "playwright-core",
    "--outdir",
    "dist",
    "./src/index.ts",
  ], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  try {
    await access(entrypoint, constants.R_OK);
  } catch (error) {
    throw new MikaCliError("NODE_REEXEC_ENTRYPOINT_MISSING", "MikaCLI could not build the Node CLI bundle required for shared-browser actions.", {
      cause: error,
      details: {
        entrypoint,
      },
    });
  }
}

function spawnAndWait(
  command: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio?: "inherit" | "pipe";
  } = {},
): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio ?? "inherit",
    });

    child.on("error", (error) => {
      rejectPromise(new MikaCliError(
        "NODE_RUNTIME_NOT_FOUND",
        `MikaCLI could not start Node for the shared-browser fallback. Install Node 20+ or set MIKACLI_NODE_PATH.`,
        {
          cause: error,
          details: {
            command,
            args,
          },
        },
      ));
    });

    child.on("close", (code) => {
      resolvePromise(typeof code === "number" ? code : 1);
    });
  });
}

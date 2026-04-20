#!/usr/bin/env bun

import { chmod, lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const distEntry = join(projectRoot, "dist", "index.js");

const bunHome = process.env.BUN_INSTALL ?? join(homedir(), ".bun");
const globalNodeModules = join(bunHome, "install", "global", "node_modules");
const globalBin = join(bunHome, "bin");
const packageLinkPath = join(globalNodeModules, "mikacli");
const binLinkPath = join(globalBin, "mikacli");

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function removeIfDifferent(linkPath: string, targetPath: string): Promise<void> {
  try {
    const stats = await lstat(linkPath);
    if (stats.isSymbolicLink()) {
      const currentTarget = await readlink(linkPath);
      const resolvedTarget = resolve(dirname(linkPath), currentTarget);
      if (resolvedTarget === targetPath) {
        return;
      }
    }

    await rm(linkPath, { force: true, recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function ensureSymlink(linkPath: string, targetPath: string, type: "dir" | "file"): Promise<void> {
  await ensureParentDir(linkPath);
  await removeIfDifferent(linkPath, targetPath);

  try {
    await lstat(linkPath);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await symlink(targetPath, linkPath, type);
}

async function main(): Promise<void> {
  try {
    await chmod(distEntry, 0o755);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error('Missing "dist/index.js". Run "bun run build" first.');
    }

    throw error;
  }

  await mkdir(globalNodeModules, { recursive: true });
  await mkdir(globalBin, { recursive: true });

  await ensureSymlink(packageLinkPath, projectRoot, "dir");
  await ensureSymlink(binLinkPath, distEntry, "file");

  console.log(`Linked mikacli to ${binLinkPath}`);
  console.log('Run "mikacli --help" in a new shell if your current shell still caches command lookups.');
}

await main();

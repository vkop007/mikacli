#!/usr/bin/env bun

import { cp, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { generateSkillProviderReferences } from "./generate-skill-provider-references.ts";

const projectRoot = resolve(dirname(import.meta.dir));
const sourceSkillDir = join(projectRoot, "skills", "mikacli");
const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");
const targetSkillsDir = join(codexHome, "skills");
const targetSkillDir = join(targetSkillsDir, "mikacli");

async function main(): Promise<void> {
  await generateSkillProviderReferences();
  await mkdir(targetSkillsDir, { recursive: true });
  await rm(targetSkillDir, { recursive: true, force: true });
  await cp(sourceSkillDir, targetSkillDir, { recursive: true });

  console.log("MikaCLI skill references regenerated.");
  console.log(`Installed Codex skill synced to ${targetSkillDir}`);
}

await main();

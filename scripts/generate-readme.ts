#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolvePlatformCapabilityMetadata } from "../src/core/runtime/platform-capability-metadata.js";
import { getPlatformCategories, getPlatformDefinitions, getPlatformDefinitionsByCategory } from "../src/platforms/index.js";
import { buildPlatformCommandPrefix } from "../src/core/runtime/platform-command-prefix.js";

import type { AuthStrategyKind } from "../src/core/auth/auth-types.js";
import type { PlatformCategory, PlatformDefinition } from "../src/core/runtime/platform-definition.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(__dirname);
const readmePath = resolve(repoRoot, "README.md");
const packageJsonPath = resolve(repoRoot, "package.json");
const DEFAULT_PACKAGE_NAME = "mikacli";

const GENERATED_BLOCKS = {
  badges: "badges",
  whyItMattersCount: "why-it-matters-count",
  atAGlance: "at-a-glance",
  commandModelCategories: "command-model-categories",
  categoryOverview: "category-overview",
  providerMatrix: "provider-matrix",
} as const;

const AUTH_LABELS: Record<AuthStrategyKind, string> = {
  cookies: "cookies",
  oauth2: "oauth2",
  apiKey: "api token",
  botToken: "bot token",
  session: "session",
  none: "none",
};

const CATEGORY_SUMMARIES: Record<PlatformCategory, string> = {
  llm: "Prompting, chat, image, and generation workflows.",
  editor: "Local file, media, and document transformations.",
  finance: "Market, forex, and crypto lookups.",
  data: "Structured data cleanup, conversion, filtering, and extraction.",
  google: "Google Workspace APIs and account-backed productivity flows.",
  maps: "Geocoding, routing, elevation, and geometry helpers.",
  movie: "Title lookup, recommendations, and streaming availability.",
  news: "Headline discovery, source search, and feed aggregation.",
  music: "Music discovery, playback, and library-style workflows.",
  social: "Posting, profile lookup, messaging, and public social reads.",
  careers: "Job search and hiring discovery workflows.",
  shopping: "Product discovery plus cart and order surfaces where supported.",
  developer: "Code hosting, issues, docs, and workspace automation.",
  devops: "Infrastructure, deployments, DNS, and uptime automation.",
  bot: "Bot-token messaging and chat ops.",
  tools: "Public utilities, temp mail, downloads, transcripts, and web helpers.",
  forum: "Forum-style communities, threads, and discussions.",
};

const CATEGORY_HEADINGS: Partial<Record<PlatformCategory, string>> = {
  llm: "LLM",
  devops: "DevOps",
};

interface ReadmeContext {
  categories: readonly PlatformCategory[];
  providerCount: number;
  categoryCount: number;
  packageName: string;
}

export async function renderReadme(): Promise<string> {
  const [template, packageJsonRaw] = await Promise.all([
    readFile(readmePath, "utf8"),
    readFile(packageJsonPath, "utf8").catch(() => ""),
  ]);
  const packageName = parsePackageName(packageJsonRaw) ?? DEFAULT_PACKAGE_NAME;
  return renderReadmeFromTemplate(template, { packageName });
}

export function renderReadmeFromTemplate(template: string, options: { packageName?: string } = {}): string {
  const normalizedTemplate = template.replace(/\r\n/g, "\n");
  const definitions = [...getPlatformDefinitions()];
  const categories = [...getPlatformCategories()];
  const context: ReadmeContext = {
    categories,
    providerCount: definitions.length,
    categoryCount: categories.length,
    packageName: options.packageName ?? DEFAULT_PACKAGE_NAME,
  };

  let output = normalizedTemplate;
  output = replaceGeneratedBlock(output, GENERATED_BLOCKS.badges, renderBadges(context));
  output = replaceGeneratedBlock(output, GENERATED_BLOCKS.whyItMattersCount, renderWhyItMattersCount(context));
  output = replaceGeneratedBlock(output, GENERATED_BLOCKS.atAGlance, renderAtAGlance(context));
  output = replaceGeneratedBlock(output, GENERATED_BLOCKS.commandModelCategories, renderCommandModelCategories(context));
  output = replaceGeneratedBlock(output, GENERATED_BLOCKS.categoryOverview, renderCategoryOverview(context));
  output = replaceGeneratedBlock(output, GENERATED_BLOCKS.providerMatrix, renderProviderMatrix(context));

  return output.trimEnd() + "\n";
}

export async function generateReadme(): Promise<void> {
  const readme = await renderReadme();
  await writeFile(readmePath, readme, "utf8");
}

function renderBadges(context: ReadmeContext): string {
  const encodedPackageName = encodeURIComponent(context.packageName);

  return [
    `[![npm version](https://img.shields.io/npm/v/${encodedPackageName})](https://www.npmjs.com/package/${context.packageName})`,
    `[![license](https://img.shields.io/github/license/vkop007/mikacli)](./LICENSE)`,
    `[![providers](https://img.shields.io/badge/providers-${context.providerCount}-blue)](#category-overview)`,
    `[![categories](https://img.shields.io/badge/categories-${context.categoryCount}-6f42c1)](#category-overview)`,
  ].join("\n");
}

function renderWhyItMattersCount(context: ReadmeContext): string {
  return `- One command surface across \`${context.providerCount}\` providers.`;
}

function renderAtAGlance(context: ReadmeContext): string {
  return [
    "| Item | Value |",
    "| --- | --- |",
    `| Package | \`${context.packageName}\` |`,
    "| CLI command | `mikacli` |",
    `| Providers | \`${context.providerCount}\` |`,
    `| Categories | \`${context.categoryCount}\` |`,
    `| npm install | \`npm install -g ${context.packageName}\` |`,
    `| bun install | \`bun install -g ${context.packageName}\` |`,
    "| Local setup | `bun install` |",
    "| Docs sync | `bun run sync:docs` |",
  ].join("\n");
}

function renderCommandModelCategories(context: ReadmeContext): string {
  return context.categories.map((category) => `- \`mikacli ${category} ...\``).join("\n");
}

function renderCategoryOverview(context: ReadmeContext): string {
  const lines = [
    "This inventory is generated from the live platform registry.",
    "",
    "| Category | Representative providers | Count | Auth modes | Use it for | Route |",
    "| --- | --- | ---: | --- | --- | --- |",
  ];

  for (const category of context.categories) {
    const definitions = [...getPlatformDefinitionsByCategory(category)].sort((left, right) => left.id.localeCompare(right.id));
    const providers = formatRepresentativeProviders(definitions);
    const authModes = formatCategoryAuthModes(definitions);
    const route = `\`mikacli ${category} ...\``;
    lines.push(
      `| \`${category}\` | ${providers} | ${definitions.length} | ${authModes} | ${CATEGORY_SUMMARIES[category]} | ${route} |`,
    );
  }

  lines.push("");
  lines.push(`MikaCLI currently exposes \`${context.providerCount}\` providers across \`${context.categoryCount}\` active command groups.`);
  return lines.join("\n");
}

function renderProviderMatrix(context: ReadmeContext): string {
  const sections = [
    "The tables below are generated from provider manifests and runtime capability metadata, so they stay aligned with `mikacli <category> <provider> capabilities --json`.",
    "",
  ];

  for (const category of context.categories) {
    const definitions = [...getPlatformDefinitionsByCategory(category)].sort((left, right) => left.displayName.localeCompare(right.displayName));
    sections.push(`### ${CATEGORY_HEADINGS[category] ?? toTitleCase(category)}`);
    sections.push("");
    sections.push("| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |");
    sections.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

    for (const definition of definitions) {
      const metadata = resolvePlatformCapabilityMetadata(definition);
      sections.push(
        `| ${definition.displayName} | \`${metadata.stability}\` | ${formatAuthStrategies(definition.authStrategies)} | \`${metadata.discovery}\` | \`${metadata.mutation}\` | \`${metadata.browserLogin}\` | \`${metadata.asyncJobs}\` | \`${buildPlatformCommandPrefix(definition)}\` |`,
      );
    }

    const notes = collectProviderNotes(definitions);
    if (notes.length > 0) {
      sections.push("");
      sections.push("Notes:");
      for (const note of notes) {
        sections.push(`- ${note}`);
      }
    }

    sections.push("");
  }

  return sections.join("\n").trimEnd();
}

function collectProviderNotes(definitions: readonly PlatformDefinition[]): string[] {
  const notes: string[] = [];

  for (const definition of definitions) {
    const metadata = resolvePlatformCapabilityMetadata(definition);
    for (const note of metadata.notes ?? []) {
      notes.push(`\`${definition.id}\`: ${note}`);
    }
  }

  return notes;
}

function formatRepresentativeProviders(definitions: readonly PlatformDefinition[]): string {
  const names = definitions.map((definition) => `\`${definition.id}\``);
  if (names.length <= 5) {
    return names.join(", ");
  }

  const visible = names.slice(0, 5).join(", ");
  return `${visible}, +${names.length - 5} more`;
}

function formatCategoryAuthModes(definitions: readonly PlatformDefinition[]): string {
  const values = new Set<string>();

  for (const definition of definitions) {
    for (const strategy of definition.authStrategies) {
      values.add(AUTH_LABELS[strategy]);
    }
  }

  return Array.from(values).sort((left, right) => left.localeCompare(right)).map((value) => `\`${value}\``).join(", ");
}

function formatAuthStrategies(strategies: readonly AuthStrategyKind[]): string {
  return strategies.map((strategy) => `\`${AUTH_LABELS[strategy]}\``).join(", ");
}

function replaceGeneratedBlock(readme: string, name: string, content: string): string {
  const start = `<!-- GENERATED:${name}:start -->`;
  const end = `<!-- GENERATED:${name}:end -->`;
  const pattern = new RegExp(`${escapeForRegExp(start)}[\\s\\S]*?${escapeForRegExp(end)}`);

  if (!pattern.test(readme)) {
    throw new Error(`README is missing generated block markers for "${name}".`);
  }

  return readme.replace(pattern, `${start}\n${content.trimEnd()}\n${end}`);
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parsePackageName(rawPackageJson: string): string | null {
  if (!rawPackageJson.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPackageJson) as { name?: unknown };
    if (typeof parsed.name !== "string") {
      return null;
    }

    const packageName = parsed.name.trim();
    return packageName.length > 0 ? packageName : null;
  } catch {
    return null;
  }
}

if (import.meta.main) {
  await generateReadme();
}

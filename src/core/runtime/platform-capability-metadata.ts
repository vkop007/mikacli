import { Command } from "commander";
import pc from "picocolors";

import { resolveCommandContext } from "../../utils/cli.js";
import { printJson } from "../../utils/output.js";
import { buildPlatformCommandPrefix } from "./platform-command-prefix.js";

import type {
  PlatformCapabilityMetadata,
  PlatformCapabilityMetadataInput,
  PlatformCategory,
  PlatformCapabilitySupport,
  PlatformDefinition,
  PlatformStability,
} from "./platform-definition.js";

const BASE_DEFAULTS: PlatformCapabilityMetadataInput = {
  discovery: "unknown",
  mutation: "unknown",
  browserLogin: "unsupported",
  browserFallback: "unsupported",
  asyncJobs: "unsupported",
  stability: "unknown",
};

const CATEGORY_DEFAULTS: Partial<Record<PlatformCategory, PlatformCapabilityMetadataInput>> = {
  llm: {
    discovery: "supported",
    mutation: "supported",
    browserLogin: "partial",
    asyncJobs: "partial",
    stability: "partial",
  },
  editor: {
    discovery: "supported",
    mutation: "supported",
    stability: "stable",
  },
  finance: {
    discovery: "supported",
    mutation: "unsupported",
    stability: "stable",
  },
  data: {
    discovery: "supported",
    mutation: "supported",
    stability: "stable",
  },
  maps: {
    discovery: "supported",
    mutation: "unsupported",
    stability: "stable",
  },
  movie: {
    discovery: "supported",
    mutation: "unsupported",
    stability: "stable",
  },
  news: {
    discovery: "supported",
    mutation: "unsupported",
    stability: "stable",
  },
  music: {
    discovery: "supported",
    mutation: "unknown",
    browserLogin: "partial",
    stability: "partial",
  },
  social: {
    discovery: "supported",
    mutation: "unknown",
    browserLogin: "partial",
    stability: "partial",
  },
  shopping: {
    discovery: "supported",
    mutation: "unknown",
    browserLogin: "partial",
    stability: "partial",
  },
  developer: {
    discovery: "supported",
    mutation: "unknown",
    browserLogin: "partial",
    stability: "partial",
  },
  devops: {
    discovery: "supported",
    mutation: "unsupported",
    stability: "partial",
  },
  bot: {
    discovery: "supported",
    mutation: "supported",
    stability: "stable",
  },
  forum: {
    discovery: "supported",
    mutation: "unknown",
    browserLogin: "partial",
    stability: "partial",
  },
  tools: {
    discovery: "supported",
    mutation: "unknown",
    stability: "stable",
  },
};

const PROVIDER_OVERRIDES: Partial<Record<PlatformDefinition["id"], PlatformCapabilityMetadataInput>> = {
  chatgpt: {
    browserLogin: "supported",
    stability: "stable",
    notes: ["Shared browser login works well for cookie capture and reuse."],
  },
  claude: {
    browserLogin: "supported",
    stability: "partial",
  },
  deepseek: {
    browserLogin: "supported",
    stability: "partial",
    notes: ["Some flows also need a token recovered from browser storage."],
  },
  gemini: {
    browserLogin: "supported",
    stability: "stable",
    asyncJobs: "partial",
  },
  grok: {
    browserLogin: "supported",
    stability: "partial",
    asyncJobs: "supported",
  },
  mistral: {
    browserLogin: "supported",
    stability: "partial",
  },
  perplexity: {
    browserLogin: "supported",
    stability: "partial",
  },
  qwen: {
    browserLogin: "supported",
    stability: "partial",
  },
  zai: {
    browserLogin: "supported",
    stability: "partial",
  },
  github: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "stable",
    notes: ["Uses a saved GitHub web session for browserless repository automation."],
  },
  gitlab: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "stable",
  },
  jira: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "stable",
  },
  trello: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "stable",
  },
  confluence: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "stable",
  },
  notion: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "partial",
  },
  linear: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "partial",
  },
  cloudflare: {
    stability: "stable",
  },
  vercel: {
    stability: "stable",
  },
  supabase: {
    stability: "stable",
  },
  render: {
    stability: "stable",
  },
  netlify: {
    stability: "stable",
  },
  digitalocean: {
    stability: "stable",
  },
  railway: {
    stability: "partial",
    notes: ["Uses Railway's GraphQL surface, so some deeper actions may still be added later."],
  },
  fly: {
    stability: "partial",
    notes: ["Org-aware app listing may require an explicit --org slug for some tokens."],
  },
  reddit: {
    mutation: "supported",
    browserLogin: "supported",
    browserFallback: "supported",
    stability: "partial",
    notes: ["Public reads are stable; writes can use a saved session or the shared browser profile."],
  },
  x: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "partial",
  },
  instagram: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "partial",
  },
  facebook: {
    mutation: "partial",
    browserLogin: "supported",
    stability: "partial",
  },
  linkedin: {
    mutation: "partial",
    browserLogin: "supported",
    stability: "partial",
  },
  tiktok: {
    mutation: "partial",
    browserLogin: "supported",
    stability: "partial",
  },
  youtube: {
    mutation: "partial",
    browserLogin: "supported",
    stability: "partial",
  },
  bluesky: {
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "stable",
  },
  mastodon: {
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "stable",
  },
  pinterest: {
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "stable",
  },
  threads: {
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "partial",
  },
  telegram: {
    mutation: "supported",
    browserLogin: "unsupported",
    stability: "partial",
    notes: ["Uses saved MTProto sessions instead of browser cookies."],
  },
  whatsapp: {
    mutation: "supported",
    browserLogin: "unsupported",
    stability: "partial",
    notes: ["Uses QR or pairing-code session state instead of browser cookies."],
  },
  amazon: {
    mutation: "partial",
    browserLogin: "supported",
    stability: "partial",
  },
  flipkart: {
    mutation: "partial",
    browserLogin: "supported",
    stability: "stable",
  },
  ebay: {
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "stable",
  },
  etsy: {
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "partial",
  },
  spotify: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "stable",
  },
  "youtube-music": {
    mutation: "supported",
    browserLogin: "supported",
    stability: "partial",
  },
  soundcloud: {
    mutation: "partial",
    stability: "stable",
  },
  bandcamp: {
    mutation: "unsupported",
    stability: "stable",
  },
  deezer: {
    mutation: "unsupported",
    stability: "stable",
  },
  http: {
    discovery: "supported",
    mutation: "supported",
    browserFallback: "supported",
    stability: "stable",
    notes: ["Best used with saved sessions or the shared browser profile for authenticated request inspection and replay."],
  },
  news: {
    stability: "stable",
  },
};

export function resolvePlatformCapabilityMetadata(definition: PlatformDefinition): PlatformCapabilityMetadata {
  const merged: PlatformCapabilityMetadataInput = {
    ...BASE_DEFAULTS,
    ...(CATEGORY_DEFAULTS[definition.category] ?? {}),
    ...(PROVIDER_OVERRIDES[definition.id] ?? {}),
    ...(definition.capabilityMetadata ?? {}),
  };

  return {
    auth: definition.authStrategies,
    discovery: merged.discovery ?? "unknown",
    mutation: merged.mutation ?? "unknown",
    browserLogin: merged.browserLogin ?? "unsupported",
    browserFallback: merged.browserFallback ?? "unsupported",
    asyncJobs: merged.asyncJobs ?? "unsupported",
    stability: merged.stability ?? "unknown",
    notes: merged.notes,
  };
}

export function buildCapabilityMetadataHelpText(definition: PlatformDefinition): string {
  const metadata = resolvePlatformCapabilityMetadata(definition);
  const notes = metadata.notes ?? [];
  const capabilityCommand = `${buildPlatformCommandPrefix(definition)} capabilities --json`;
  const rows: Array<[string, string]> = [
    ["auth", metadata.auth.join(", ") || "none"],
    ["stability", metadata.stability],
    ["discovery", metadata.discovery],
    ["mutation", metadata.mutation],
    ["browser login", metadata.browserLogin],
    ["browser fallback", metadata.browserFallback],
    ["async jobs", metadata.asyncJobs],
    ["inspect metadata", capabilityCommand],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));

  return `
Support Profile:
${rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`).join("\n")}${notes.length > 0 ? `\n  notes${" ".repeat(Math.max(0, width - "notes".length))}  ${notes.join(" | ")}` : ""}
`;
}

export function buildStabilityGuideHelpText(): string {
  return `
Stability Guide:
  stable        Ready for routine automation.
  partial       Core flows work well, with some narrower or evolving edges.
  experimental  Useful, but still changing quickly.
`;
}

export function registerCapabilityMetadataCommand(command: Command, definition: PlatformDefinition): void {
  command
    .command("capabilities")
    .alias("caps")
    .description("Show machine-readable capability metadata for this provider")
    .action((...rawArgs: unknown[]) => {
      const cmd = rawArgs.at(-1) as Command;
      const ctx = resolveCommandContext(cmd);
      const metadata = resolvePlatformCapabilityMetadata(definition);

      const payload = {
        ok: true,
        platform: definition.id,
        category: definition.category,
        displayName: definition.displayName,
        capabilities: metadata,
      };

      if (ctx.json) {
        printJson(payload);
        return;
      }

      console.log(`${pc.bold(definition.displayName)} capability metadata`);
      console.log(`platform: ${definition.id}`);
      console.log(`category: ${definition.category}`);
      console.log(`auth: ${metadata.auth.join(", ") || "none"}`);
      console.log(`stability: ${colorizeStability(metadata.stability)}`);
      console.log(`discovery: ${colorizeSupport(metadata.discovery)}`);
      console.log(`mutation: ${colorizeSupport(metadata.mutation)}`);
      console.log(`browser login: ${colorizeSupport(metadata.browserLogin)}`);
      console.log(`browser fallback: ${colorizeSupport(metadata.browserFallback)}`);
      console.log(`async jobs: ${colorizeSupport(metadata.asyncJobs)}`);

      if ((metadata.notes?.length ?? 0) > 0) {
        console.log("notes:");
        for (const note of metadata.notes ?? []) {
          console.log(`- ${note}`);
        }
      }
    });
}

function colorizeSupport(value: PlatformCapabilitySupport): string {
  switch (value) {
    case "supported":
      return pc.green(value);
    case "partial":
      return pc.yellow(value);
    case "unsupported":
      return pc.red(value);
    default:
      return pc.dim(value);
  }
}

function colorizeStability(value: PlatformStability): string {
  switch (value) {
    case "stable":
      return pc.green(value);
    case "partial":
      return pc.yellow(value);
    case "experimental":
      return pc.magenta(value);
    default:
      return pc.dim(value);
  }
}

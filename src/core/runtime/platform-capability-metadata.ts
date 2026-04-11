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
  google: {
    discovery: "supported",
    mutation: "supported",
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
    browserFallback: "supported",
    stability: "partial",
    asyncJobs: "supported",
    notes: ["AutoCLI can fall back to an in-browser Grok request path when the browserless endpoint is blocked."],
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
  gmail: {
    mutation: "supported",
    stability: "stable",
    notes: ["Uses Google's OAuth2 flow and stores refresh tokens locally for headless reuse."],
  },
  calendar: {
    mutation: "supported",
    stability: "stable",
    notes: ["Uses Google's OAuth2 flow for calendar listing plus Google Calendar event reads and writes."],
  },
  drive: {
    mutation: "supported",
    stability: "stable",
    notes: ["Uses Google's OAuth2 flow and supports Drive file listing, uploads, downloads, and deletes."],
  },
  sheets: {
    mutation: "supported",
    stability: "stable",
    notes: ["Uses Google's OAuth2 flow for spreadsheet reads and writes."],
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
    browserFallback: "supported",
    stability: "partial",
    notes: ["X write actions run through browser-backed flows. Use `--browser` to force the shared AutoCLI browser profile immediately when you want the live browser path."],
  },
  instagram: {
    mutation: "supported",
    browserLogin: "supported",
    browserFallback: "supported",
    stability: "partial",
    notes: ["Reads and image/comment writes are browserless; post and comment deletion can fall back to browser-backed flows when Instagram's web APIs get flaky."],
  },
  facebook: {
    mutation: "supported",
    browserLogin: "supported",
    browserFallback: "supported",
    stability: "partial",
    notes: ["Facebook writes now run through browser-backed post, like, and comment flows. Use `--browser` to jump straight into the shared AutoCLI browser profile when you want the visible browser path."],
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
  twitch: {
    mutation: "partial",
    browserLogin: "supported",
    browserFallback: "supported",
    stability: "partial",
    notes: [
      "Uses Twitch's authenticated web GraphQL surface for channel, stream, video, and clip lookups.",
      "Follow and unfollow try Twitch's web mutation path first, then can fall back to the shared AutoCLI browser profile when Twitch enforces an integrity challenge.",
      "Clip creation and stream settings updates currently run through the shared AutoCLI browser profile.",
    ],
  },
  youtube: {
    mutation: "partial",
    browserLogin: "supported",
    browserFallback: "supported",
    stability: "partial",
    notes: ["Studio uploads are browser-backed. Watch-page likes, dislikes, comments, and subscriptions still use request tokens from the saved session."],
  },
  bluesky: {
    mutation: "supported",
    browserLogin: "unsupported",
    stability: "stable",
    notes: ["Public reads stay available without auth. App-password login enables saved-session `me`, `post`, `comment`, and `like` commands without browser automation."],
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
    browserFallback: "supported",
    stability: "partial",
    notes: ["`add-to-cart`, `remove-from-cart`, `update-cart`, `orders`, `order`, and `cart` support browser-backed execution when the saved session alone is not enough."],
  },
  flipkart: {
    mutation: "supported",
    browserLogin: "supported",
    stability: "stable",
    notes: [
      "Uses the saved Flipkart session for cart actions. New adds use the authenticated cart endpoint; quantity updates and removals use the saved session in an invisible browser.",
    ],
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

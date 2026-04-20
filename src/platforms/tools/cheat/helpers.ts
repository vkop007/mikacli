import { MikaCliError } from "../../../errors.js";

export const CHEAT_BASE_URL = "https://cht.sh";
export const CHEAT_MAX_SNIPPET_LENGTH = 4000;
export const CHEAT_SHELLS = ["bash", "fish", "powershell", "zsh"] as const;

export type CheatShell = (typeof CHEAT_SHELLS)[number];

export function normalizeCheatShell(value?: string): CheatShell | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if ((CHEAT_SHELLS as readonly string[]).includes(normalized)) {
    return normalized as CheatShell;
  }

  throw new MikaCliError(
    "CHEAT_INVALID_SHELL",
    `Unknown shell "${value}". Supported shells: ${CHEAT_SHELLS.join(", ")}.`,
    {
      details: {
        shell: value,
        supportedShells: CHEAT_SHELLS,
      },
    },
  );
}

export function normalizeCheatLanguage(value?: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes("/")) {
    throw new MikaCliError("CHEAT_INVALID_LANGUAGE", "Language cannot contain '/'.");
  }

  return normalized;
}

export function normalizeCheatTopic(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MikaCliError("CHEAT_TOPIC_REQUIRED", "Provide a cheat topic.");
  }

  return normalized;
}

export function buildCheatUrl(input: { topic: string; shell?: CheatShell; lang?: string }): string {
  const prefix = input.lang ?? input.shell;
  const segments = prefix ? [encodePathSegment(prefix), encodeTopicSegment(input.topic)] : [encodeTopicSegment(input.topic)];
  return `${CHEAT_BASE_URL}/${segments.join("/")}?T`;
}

export function truncateCheatSnippet(value: string, limit = CHEAT_MAX_SNIPPET_LENGTH): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 16)).trimEnd()}\n... [truncated]`;
}

function encodeTopicSegment(topic: string): string {
  return topic
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => encodePathSegment(part))
    .join("+");
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}


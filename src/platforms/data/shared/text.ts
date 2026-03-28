const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.startsWith("#x")) {
      const code = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }

    if (normalized.startsWith("#")) {
      const code = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }

    return NAMED_HTML_ENTITIES[normalized] ?? entity;
  });
}

export function htmlToText(html: string): string {
  const normalized = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|table|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeWhitespace(decodeHtmlEntities(normalized));
}

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function dedupeLines(content: string, ignoreCase = false): string {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const line of content.split(/\r?\n/)) {
    const key = ignoreCase ? line.toLowerCase() : line;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(line);
  }

  return output.join("\n");
}

export function collectTextStats(content: string): {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
  emptyLines: number;
} {
  const lines = content.split(/\r?\n/);
  const words = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;

  return {
    characters: content.length,
    charactersNoSpaces: content.replace(/\s/g, "").length,
    words,
    lines: lines.length,
    emptyLines: lines.filter((line) => line.trim().length === 0).length,
  };
}

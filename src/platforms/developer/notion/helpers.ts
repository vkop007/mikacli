import { AutoCliError } from "../../../errors.js";

const NOTION_ID_REGEX = /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export type NotionRichText = Array<{
  plain_text?: string;
  href?: string | null;
  type?: string;
  text?: {
    content?: string;
    link?: {
      url?: string;
    } | null;
  };
}>;

export function normalizeNotionId(target: string): string {
  const trimmed = target.trim();
  if (trimmed.length === 0) {
    throw new AutoCliError("NOTION_ID_INVALID", "Notion ID or URL cannot be empty.");
  }

  let candidate = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    const match = trimmed.match(NOTION_ID_REGEX);
    if (!match) {
      throw new AutoCliError("NOTION_ID_INVALID", `Could not find a Notion ID in "${target}".`);
    }
    candidate = match[1] ?? match[0];
  }

  const compact = candidate.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(compact)) {
    throw new AutoCliError("NOTION_ID_INVALID", `Invalid Notion ID "${target}". Expected a 32-character UUID or a Notion URL.`, {
      details: {
        target,
      },
    });
  }

  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
}

export function richTextFromPlainText(text: string): Array<Record<string, unknown>> {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => ({
      type: "text",
      text: {
        content: part,
      },
    }));
}

export function plainTextFromRichText(richText: NotionRichText | undefined): string | undefined {
  if (!Array.isArray(richText) || richText.length === 0) {
    return undefined;
  }

  const text = richText
    .map((part) => {
      if (typeof part.plain_text === "string") {
        return part.plain_text;
      }

      if (typeof part.text?.content === "string") {
        return part.text.content;
      }

      return "";
    })
    .join("")
    .trim();

  return text.length > 0 ? text : undefined;
}

export function findTitlePropertyName(properties: Record<string, unknown> | undefined): string | undefined {
  if (!properties || typeof properties !== "object") {
    return undefined;
  }

  for (const [name, rawProperty] of Object.entries(properties)) {
    if (!rawProperty || typeof rawProperty !== "object") {
      continue;
    }

    const property = rawProperty as { type?: unknown };
    if (property.type === "title") {
      return name;
    }
  }

  return undefined;
}

export function extractPageTitle(page: { properties?: Record<string, unknown>; url?: string; id?: string }): string {
  const titlePropertyName = findTitlePropertyName(page.properties);
  if (titlePropertyName) {
    const rawProperty = page.properties?.[titlePropertyName];
    if (rawProperty && typeof rawProperty === "object") {
      const titleValue = (rawProperty as { title?: NotionRichText }).title;
      const title = plainTextFromRichText(titleValue);
      if (title) {
        return title;
      }
    }
  }

  return page.url ?? page.id ?? "Untitled page";
}

export function extractDataSourceTitle(dataSource: { title?: NotionRichText; id?: string; url?: string }): string {
  return plainTextFromRichText(dataSource.title) ?? dataSource.url ?? dataSource.id ?? "Untitled data source";
}

export function buildParagraphBlocks(text: string): Array<Record<string, unknown>> {
  const fragments = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return fragments.map((fragment) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: richTextFromPlainText(fragment),
    },
  }));
}

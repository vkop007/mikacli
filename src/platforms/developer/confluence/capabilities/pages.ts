import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { confluenceAdapter, type ConfluenceAdapter } from "../adapter.js";
import { printConfluenceListResult, printConfluencePageResult } from "../output.js";

export function createConfluenceSearchCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "search",
    command: "search <query>",
    description: "Search Confluence pages the saved web session can read",
    spinnerText: "Searching Confluence...",
    successMessage: "Confluence search loaded.",
    options: [
      { flags: "--space <key>", description: "Optional Confluence space key filter" },
      { flags: "--limit <number>", description: "Maximum pages to load (default: 20)", parser: parsePositiveInteger },
    ],
    action: ({ args, options }) =>
      adapter.search({
        query: String(args[0] ?? ""),
        space: options.space as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printConfluenceListResult,
  });
}

export function createConfluencePageCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "page",
    command: "page <target>",
    description: "Load a Confluence page by page ID, page URL, or fallback search text",
    spinnerText: "Loading Confluence page...",
    successMessage: "Confluence page loaded.",
    action: ({ args }) => adapter.page(String(args[0] ?? "")),
    onSuccess: printConfluencePageResult,
  });
}

export function createConfluenceChildrenCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "children",
    command: "children <target>",
    description: "List direct child pages for a Confluence page",
    spinnerText: "Loading Confluence child pages...",
    successMessage: "Confluence child pages loaded.",
    options: [{ flags: "--limit <number>", description: "Maximum child pages to load (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.children({
        target: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printConfluenceListResult,
  });
}

export function createConfluenceCreatePageCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "create-page",
    command: "create-page",
    description: "Create a new Confluence page in a space, with an optional parent and body",
    spinnerText: "Creating Confluence page...",
    successMessage: "Confluence page created.",
    options: [
      { flags: "--space <key>", description: "Confluence space key", required: true },
      { flags: "--title <text>", description: "Page title", required: true },
      { flags: "--parent <target>", description: "Optional parent page ID or URL" },
      { flags: "--body <text>", description: "Optional initial page body as plain text paragraphs" },
    ],
    action: ({ options }) =>
      adapter.createPage({
        space: String(options.space ?? ""),
        title: String(options.title ?? ""),
        parent: options.parent as string | undefined,
        body: options.body as string | undefined,
      }),
    onSuccess: printConfluencePageResult,
  });
}

export function createConfluenceUpdatePageCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "update-page",
    command: "update-page <target>",
    description: "Update a Confluence page title or body",
    spinnerText: "Updating Confluence page...",
    successMessage: "Confluence page updated.",
    options: [
      { flags: "--title <text>", description: "New page title" },
      { flags: "--body <text>", description: "Replacement page body as plain text paragraphs" },
      { flags: "--minor", description: "Mark the edit as a minor update" },
    ],
    action: ({ args, options }) =>
      adapter.updatePage({
        target: String(args[0] ?? ""),
        title: options.title as string | undefined,
        body: options.body as string | undefined,
        minorEdit: Boolean(options.minor),
      }),
    onSuccess: printConfluencePageResult,
  });
}

export function createConfluenceCommentCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "comment",
    command: "comment <target>",
    description: "Add a plain-text comment to a Confluence page",
    spinnerText: "Creating Confluence comment...",
    successMessage: "Confluence comment created.",
    options: [{ flags: "--text <text>", description: "Comment text", required: true }],
    action: ({ args, options }) =>
      adapter.comment({
        target: String(args[0] ?? ""),
        text: String(options.text ?? ""),
      }),
    onSuccess: printConfluencePageResult,
  });
}

export const confluenceSearchCapability = createConfluenceSearchCapability(confluenceAdapter);
export const confluencePageCapability = createConfluencePageCapability(confluenceAdapter);
export const confluenceChildrenCapability = createConfluenceChildrenCapability(confluenceAdapter);
export const confluenceCreatePageCapability = createConfluenceCreatePageCapability(confluenceAdapter);
export const confluenceUpdatePageCapability = createConfluenceUpdatePageCapability(confluenceAdapter);
export const confluenceCommentCapability = createConfluenceCommentCapability(confluenceAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}

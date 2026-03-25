import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionPageResult } from "../output.js";

export function createNotionPageCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "page",
    command: "page <target>",
    description: "Load a single Notion page by page ID or page URL",
    spinnerText: "Loading Notion page...",
    successMessage: "Notion page loaded.",
    action: ({ args }) => adapter.page(String(args[0] ?? "")),
    onSuccess: printNotionPageResult,
  });
}

export function createNotionCreatePageCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "create-page",
    command: "create-page",
    description: "Create a new Notion page under a page or data source the integration can edit",
    spinnerText: "Creating Notion page...",
    successMessage: "Notion page created.",
    options: [
      { flags: "--parent <target>", description: "Parent Notion page or data source ID/URL", required: true },
      { flags: "--title <text>", description: "Page title", required: true },
      { flags: "--content <text>", description: "Optional initial paragraph content" },
    ],
    action: ({ options }) =>
      adapter.createPage({
        parent: String(options.parent ?? ""),
        title: String(options.title ?? ""),
        content: options.content as string | undefined,
      }),
    onSuccess: printNotionPageResult,
  });
}

export function createNotionUpdatePageCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "update-page",
    command: "update-page <target>",
    description: "Update a Notion page title or archive the page",
    spinnerText: "Updating Notion page...",
    successMessage: "Notion page updated.",
    options: [
      { flags: "--title <text>", description: "New page title" },
      { flags: "--archive", description: "Archive the page instead of deleting it" },
    ],
    action: ({ args, options }) =>
      adapter.updatePage({
        target: String(args[0] ?? ""),
        title: options.title as string | undefined,
        archive: Boolean(options.archive),
      }),
    onSuccess: printNotionPageResult,
  });
}

export function createNotionAppendCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "append",
    command: "append <target>",
    description: "Append paragraph text to a Notion page",
    spinnerText: "Appending Notion content...",
    successMessage: "Notion content appended.",
    options: [{ flags: "--text <text>", description: "Text to append as paragraph blocks", required: true }],
    action: ({ args, options }) =>
      adapter.append({
        target: String(args[0] ?? ""),
        text: String(options.text ?? ""),
      }),
    onSuccess: printNotionPageResult,
  });
}

export const notionPageCapability = createNotionPageCapability(notionAdapter);
export const notionCreatePageCapability = createNotionCreatePageCapability(notionAdapter);
export const notionUpdatePageCapability = createNotionUpdatePageCapability(notionAdapter);
export const notionAppendCapability = createNotionAppendCapability(notionAdapter);


import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionPageResult } from "../output.js";

export function createNotionCommentCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "comment",
    command: "comment <target>",
    description: "Add a comment to a Notion page",
    spinnerText: "Creating Notion comment...",
    successMessage: "Notion comment created.",
    options: [{ flags: "--text <text>", description: "Comment text", required: true }],
    action: ({ args, options }) =>
      adapter.comment({
        target: String(args[0] ?? ""),
        text: String(options.text ?? ""),
      }),
    onSuccess: printNotionPageResult,
  });
}

export const notionCommentCapability = createNotionCommentCapability(notionAdapter);


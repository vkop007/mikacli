import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearCommentResult } from "../output.js";

export function createLinearCommentCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "comment",
    command: "comment <id-or-key>",
    description: "Add a comment to a Linear issue",
    spinnerText: "Creating Linear comment...",
    successMessage: "Linear comment created.",
    options: [{ flags: "--body <text>", description: "Comment body markdown", required: true }],
    action: ({ args, options }) =>
      adapter.comment({
        target: String(args[0] ?? ""),
        body: String(options.body ?? ""),
      }),
    onSuccess: printLinearCommentResult,
  });
}

export const linearCommentCapability = createLinearCommentCapability(linearAdapter);


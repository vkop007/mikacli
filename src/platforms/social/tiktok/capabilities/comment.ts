import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { tiktokAdapter } from "../adapter.js";

export const tiktokCommentCapability = createAdapterActionCapability({
  id: "comment",
  command: "comment <target> <text>",
  description: "Comment on a TikTok video by URL or numeric item ID using the latest saved session by default",
  spinnerText: "Sending TikTok comment...",
  successMessage: "TikTok comment sent.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved TikTok session" }],
  action: ({ args, options }) =>
    tiktokAdapter.comment({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      text: String(args[1] ?? ""),
    }),
});

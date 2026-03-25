import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { facebookAdapter } from "../adapter.js";

export const facebookCommentCapability = createAdapterActionCapability({
  id: "comment",
  command: "comment <target> <text>",
  description: "Comment on a Facebook post by URL or numeric object ID using the latest saved session by default",
  spinnerText: "Sending Facebook comment...",
  successMessage: "Facebook comment sent.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Facebook session" }],
  action: ({ args, options }) =>
    facebookAdapter.comment({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      text: String(args[1] ?? ""),
    }),
});

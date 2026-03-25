import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { linkedinAdapter } from "../adapter.js";

export const linkedinCommentCapability = createAdapterActionCapability({
  id: "comment",
  command: "comment <target> <text>",
  description: "Comment on a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default",
  spinnerText: "Sending LinkedIn comment...",
  successMessage: "LinkedIn comment sent.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved LinkedIn session" }],
  action: ({ args, options }) =>
    linkedinAdapter.comment({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      text: String(args[1] ?? ""),
    }),
});

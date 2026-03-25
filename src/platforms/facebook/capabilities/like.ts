import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { facebookAdapter } from "../adapter.js";

export const facebookLikeCapability = createAdapterActionCapability({
  id: "like",
  command: "like <target>",
  description: "Like a Facebook post by URL or numeric object ID using the latest saved session by default",
  spinnerText: "Liking Facebook post...",
  successMessage: "Facebook post liked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Facebook session" }],
  action: ({ args, options }) =>
    facebookAdapter.like({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

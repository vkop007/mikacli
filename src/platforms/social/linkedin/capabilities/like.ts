import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linkedinAdapter } from "../adapter.js";

export const linkedinLikeCapability = createAdapterActionCapability({
  id: "like",
  command: "like <target>",
  description: "Like a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default",
  spinnerText: "Liking LinkedIn post...",
  successMessage: "LinkedIn post liked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved LinkedIn session" }],
  action: ({ args, options }) =>
    linkedinAdapter.like({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linkedinAdapter } from "../adapter.js";

export const linkedinPostCapability = createAdapterActionCapability({
  id: "post",
  command: "post <text>",
  aliases: ["share"],
  description: "Publish a text post on LinkedIn using the latest saved session by default",
  spinnerText: "Creating LinkedIn post...",
  successMessage: "LinkedIn post created.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved LinkedIn session" }],
  action: ({ args, options }) =>
    linkedinAdapter.postText({
      account: options.account as string | undefined,
      text: String(args[0] ?? ""),
    }),
});

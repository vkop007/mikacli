import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { facebookAdapter } from "../adapter.js";

export const facebookPostCapability = createAdapterActionCapability({
  id: "post",
  command: "post <text>",
  description: "Publish a Facebook post using the latest saved session by default",
  spinnerText: "Checking Facebook posting support...",
  successMessage: "Facebook post created.",
  options: [
    { flags: "--image <path>", description: "Optional image path for future Facebook post support" },
    { flags: "--account <name>", description: "Optional override for a specific saved Facebook session" },
  ],
  action: ({ args, options }) =>
    facebookAdapter.postText({
      account: options.account as string | undefined,
      text: String(args[0] ?? ""),
      imagePath: options.image as string | undefined,
    }),
});

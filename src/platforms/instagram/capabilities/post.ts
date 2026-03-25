import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { instagramAdapter } from "../adapter.js";

export const instagramPostCapability = createAdapterActionCapability({
  id: "post",
  command: "post <mediaPath>",
  description: "Publish an Instagram post with media and an optional caption using the latest saved session by default",
  spinnerText: "Creating Instagram post...",
  successMessage: "Instagram post created.",
  options: [
    { flags: "--caption <text>", description: "Caption for the post", required: true },
    { flags: "--account <name>", description: "Optional override for a specific saved Instagram session" },
  ],
  action: ({ args, options }) =>
    instagramAdapter.postMedia({
      account: options.account as string | undefined,
      mediaPath: String(args[0] ?? ""),
      caption: options.caption as string | undefined,
    }),
});

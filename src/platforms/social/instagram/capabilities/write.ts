import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { instagramAdapter } from "../adapter.js";

export const instagramLikeCapability = createAdapterActionCapability({
  id: "like",
  command: "like <target>",
  description: "Like an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default",
  spinnerText: "Liking Instagram post...",
  successMessage: "Instagram post liked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ args, options }) =>
    instagramAdapter.like({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const instagramUnlikeCapability = createAdapterActionCapability({
  id: "unlike",
  command: "unlike <target>",
  description: "Unlike an Instagram post by URL, shortcode, or numeric media ID",
  spinnerText: "Unliking Instagram post...",
  successMessage: "Instagram post unliked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ args, options }) =>
    instagramAdapter.unlike({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const instagramCommentCapability = createAdapterActionCapability({
  id: "comment",
  command: "comment <target> <text>",
  description: "Comment on an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default",
  spinnerText: "Sending Instagram comment...",
  successMessage: "Instagram comment sent.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ args, options }) =>
    instagramAdapter.comment({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      text: String(args[1] ?? ""),
    }),
});

export const instagramFollowCapability = createAdapterActionCapability({
  id: "follow",
  command: "follow <target>",
  description: "Follow an Instagram profile by URL, @username, username, or numeric user ID",
  spinnerText: "Following Instagram profile...",
  successMessage: "Instagram follow request sent.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ args, options }) =>
    instagramAdapter.follow({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const instagramUnfollowCapability = createAdapterActionCapability({
  id: "unfollow",
  command: "unfollow <target>",
  description: "Unfollow an Instagram profile by URL, @username, username, or numeric user ID",
  spinnerText: "Unfollowing Instagram profile...",
  successMessage: "Instagram unfollow request sent.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ args, options }) =>
    instagramAdapter.unfollow({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

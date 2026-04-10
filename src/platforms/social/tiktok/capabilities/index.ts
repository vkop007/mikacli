import { tiktokCommentCapability } from "./comment.js";
import { tiktokLikeCapability } from "./like.js";
import { tiktokLoginCapability, tiktokStatusCapability } from "./login.js";
import { tiktokPostCapability } from "./post.js";

export const tiktokCapabilities = [
  tiktokLoginCapability,
  tiktokStatusCapability,
  tiktokPostCapability,
  tiktokLikeCapability,
  tiktokCommentCapability,
] as const;

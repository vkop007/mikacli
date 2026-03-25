import { tiktokCommentCapability } from "./comment.js";
import { tiktokLikeCapability } from "./like.js";
import { tiktokLoginCapability } from "./login.js";
import { tiktokPostCapability } from "./post.js";

export const tiktokCapabilities = [
  tiktokLoginCapability,
  tiktokPostCapability,
  tiktokLikeCapability,
  tiktokCommentCapability,
] as const;

import { facebookCommentCapability } from "./comment.js";
import { facebookLikeCapability } from "./like.js";
import { facebookLoginCapability } from "./login.js";
import { facebookPostCapability } from "./post.js";

export const facebookCapabilities = [
  facebookLoginCapability,
  facebookPostCapability,
  facebookLikeCapability,
  facebookCommentCapability,
] as const;

import { facebookCommentCapability } from "./comment.js";
import { facebookLikeCapability } from "./like.js";
import { facebookLoginCapability, facebookStatusCapability } from "./login.js";
import { facebookPostCapability } from "./post.js";

export const facebookCapabilities = [
  facebookLoginCapability,
  facebookStatusCapability,
  facebookPostCapability,
  facebookLikeCapability,
  facebookCommentCapability,
] as const;

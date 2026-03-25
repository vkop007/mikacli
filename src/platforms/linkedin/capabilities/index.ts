import { linkedinCommentCapability } from "./comment.js";
import { linkedinLikeCapability } from "./like.js";
import { linkedinLoginCapability } from "./login.js";
import { linkedinPostCapability } from "./post.js";

export const linkedinCapabilities = [
  linkedinLoginCapability,
  linkedinPostCapability,
  linkedinLikeCapability,
  linkedinCommentCapability,
] as const;

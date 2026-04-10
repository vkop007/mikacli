import { linkedinCommentCapability } from "./comment.js";
import { linkedinLikeCapability } from "./like.js";
import { linkedinLoginCapability, linkedinStatusCapability } from "./login.js";
import { linkedinPostCapability } from "./post.js";

export const linkedinCapabilities = [
  linkedinLoginCapability,
  linkedinStatusCapability,
  linkedinPostCapability,
  linkedinLikeCapability,
  linkedinCommentCapability,
] as const;

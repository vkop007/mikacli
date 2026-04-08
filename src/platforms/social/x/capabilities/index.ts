import { xCommentCapability } from "./comment.js";
import { xDeleteCapability } from "./delete.js";
import { xLikeCapability } from "./like.js";
import { xLoginCapability } from "./login.js";
import { xPostCapability } from "./post.js";
import { xProfileIdCapability } from "./profileid.js";
import { xSearchCapability } from "./search.js";
import { xStatusCapability } from "./status.js";
import { xTweetIdCapability } from "./tweetid.js";
import { xTweetsCapability } from "./tweets.js";
import { xUnlikeCapability } from "./unlike.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xCapabilities: readonly PlatformCapability[] = [
  xLoginCapability,
  xStatusCapability,
  xPostCapability,
  xSearchCapability,
  xTweetIdCapability,
  xProfileIdCapability,
  xTweetsCapability,
  xDeleteCapability,
  xLikeCapability,
  xUnlikeCapability,
  xCommentCapability,
];

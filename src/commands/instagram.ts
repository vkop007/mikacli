import { Command } from "commander";

import { InstagramAdapter } from "../adapters/instagram.js";
import { Logger } from "../logger.js";
import { printJson } from "../utils/output.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../utils/cli.js";

import type { AdapterActionResult } from "../types.js";

const adapter = new InstagramAdapter();

export function createInstagramCommand(): Command {
  const command = new Command("instagram")
    .alias("ig")
    .description("Interact with Instagram using an imported browser session")
    .addHelpText(
      "afterAll",
      `
Examples:
  autocli instagram login --cookies ./instagram.cookies.txt
  autocli instagram search "blackpink"
  autocli instagram mediaid https://www.instagram.com/p/SHORTCODE/
  autocli instagram profileid @username
  autocli instagram posts @username
  autocli instagram stories @username
  autocli instagram followers @username --limit 5
  autocli instagram following @username --limit 5
  autocli instagram download https://www.instagram.com/p/SHORTCODE/
  autocli instagram post ./photo.jpg --caption "Ship it"
  autocli instagram like https://www.instagram.com/p/SHORTCODE/
  autocli instagram unlike https://www.instagram.com/p/SHORTCODE/
  autocli instagram follow @username
`,
    );

  command
    .command("login")
    .description("Import cookies and save the Instagram session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the detected username")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing Instagram session...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram session imported.",
        action: () =>
          adapter.login({
            account: options.account,
            cookieFile: options.cookies,
            cookieString: options.cookieString,
            cookieJson: options.cookieJson,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("post <mediaPath>")
    .description("Publish an Instagram post with media and an optional caption using the latest saved session by default")
    .requiredOption("--caption <text>", "Caption for the post")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (mediaPath, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating Instagram post...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram post created.",
        action: () =>
          adapter.postMedia({
            account: options.account,
            mediaPath,
            caption: options.caption,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("download <target>")
    .description("Download Instagram media by URL, shortcode, or numeric media ID")
    .option("--output-dir <path>", "Directory to write downloaded files into")
    .option("--all", "Download every asset in a carousel instead of only the first one")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Downloading Instagram media...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram download completed.",
        action: () =>
          adapter.download({
            account: options.account,
            target,
            outputDir: options.outputDir,
            all: options.all,
          }),
        onSuccess: (result) => {
          printInstagramDownloadResult(result, ctx.json);
        },
      });
    });

  command
    .command("search <query>")
    .description("Search Instagram accounts")
    .option("--limit <number>", "Maximum number of results to return (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (query, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Searching Instagram...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram search completed.",
        action: () =>
          adapter.search({
            account: options.account,
            query,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printInstagramSearchResult(result, ctx.json);
        },
      });
    });

  command
    .command("posts <target>")
    .description("List recent Instagram posts for a profile URL, @username, username, or numeric user ID")
    .option("--limit <number>", "Maximum number of posts to return (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading Instagram posts...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram posts loaded.",
        action: () =>
          adapter.posts({
            account: options.account,
            target,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printInstagramPostsResult(result, ctx.json);
        },
      });
    });

  command
    .command("stories <target>")
    .description("List active Instagram stories for a profile URL, @username, username, or numeric user ID")
    .option("--limit <number>", "Maximum number of story items to return (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading Instagram stories...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram stories loaded.",
        action: () =>
          adapter.stories({
            account: options.account,
            target,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printInstagramStoriesResult(result, ctx.json);
        },
      });
    });

  command
    .command("followers <target>")
    .description("List Instagram followers for a profile URL, @username, username, or numeric user ID")
    .option("--limit <number>", "Maximum number of followers to return (1-25, default: 5)", parseLimitOption)
    .option("--cursor <value>", "Pagination cursor from a previous --json response")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading Instagram followers...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram followers loaded.",
        action: () =>
          adapter.followers({
            account: options.account,
            target,
            limit: options.limit,
            cursor: options.cursor,
          }),
        onSuccess: (result) => {
          printInstagramUserListResult(result, ctx.json);
        },
      });
    });

  command
    .command("following <target>")
    .description("List Instagram following accounts for a profile URL, @username, username, or numeric user ID")
    .option("--limit <number>", "Maximum number of following accounts to return (1-25, default: 5)", parseLimitOption)
    .option("--cursor <value>", "Pagination cursor from a previous --json response")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading Instagram following...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram following loaded.",
        action: () =>
          adapter.following({
            account: options.account,
            target,
            limit: options.limit,
            cursor: options.cursor,
          }),
        onSuccess: (result) => {
          printInstagramUserListResult(result, ctx.json);
        },
      });
    });

  command
    .command("mediaid <target>")
    .alias("info")
    .description("Load exact Instagram media details by URL, shortcode, or numeric media ID")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading Instagram media details...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram media details loaded.",
        action: () =>
          adapter.mediaInfo({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printInstagramMediaResult(result, ctx.json);
        },
      });
    });

  command
    .command("profileid <target>")
    .alias("profile")
    .description("Load exact Instagram profile details by URL, @username, username, or numeric user ID")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading Instagram profile details...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram profile details loaded.",
        action: () =>
          adapter.profileInfo({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printInstagramProfileResult(result, ctx.json);
        },
      });
    });

  command
    .command("like <target>")
    .description("Like an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking Instagram post...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram post liked.",
        action: () =>
          adapter.like({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("unlike <target>")
    .description("Unlike an Instagram post by URL, shortcode, or numeric media ID")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Unliking Instagram post...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram post unliked.",
        action: () =>
          adapter.unlike({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("comment <target> <text>")
    .description("Comment on an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending Instagram comment...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram comment sent.",
        action: () =>
          adapter.comment({
            account: options.account,
            target,
            text,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("follow <target>")
    .description("Follow an Instagram profile by URL, @username, username, or numeric user ID")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Following Instagram profile...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram follow request sent.",
        action: () =>
          adapter.follow({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("unfollow <target>")
    .description("Unfollow an Instagram profile by URL, @username, username, or numeric user ID")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Unfollowing Instagram profile...");
      await runCommandAction({
        spinner,
        successMessage: "Instagram unfollow request sent.",
        action: () =>
          adapter.unfollow({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  return command;
}

function parseLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected --limit to be a positive integer.");
  }

  return parsed;
}

function printInstagramSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      username?: string;
      fullName?: string;
      followerCount?: number;
      isPrivate?: boolean;
      isVerified?: boolean;
      url?: string;
    };

    const meta = [
      typeof item.fullName === "string" ? item.fullName : undefined,
      typeof item.followerCount === "number" ? `${item.followerCount} followers` : undefined,
      item.isVerified ? "verified" : undefined,
      item.isPrivate ? "private" : "public",
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. @${item.username ?? "unknown"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

function printInstagramUserListResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      username?: string;
      fullName?: string;
      followerCount?: number;
      isPrivate?: boolean;
      isVerified?: boolean;
      url?: string;
    };

    const meta = [
      typeof item.fullName === "string" ? item.fullName : undefined,
      typeof item.followerCount === "number" ? `${item.followerCount} followers` : undefined,
      item.isVerified ? "verified" : undefined,
      item.isPrivate ? "private" : "public",
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. @${item.username ?? "unknown"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }

  if (typeof result.data?.nextCursor === "string" && result.data.nextCursor.length > 0) {
    console.log(`next cursor: ${result.data.nextCursor}`);
  }
}

function printInstagramDownloadResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const files = Array.isArray(result.data?.files) ? result.data.files : [];
  for (const rawFile of files) {
    if (typeof rawFile === "string" && rawFile.length > 0) {
      console.log(`file: ${rawFile}`);
    }
  }
}

function printInstagramPostsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const posts = Array.isArray(result.data?.posts) ? result.data.posts : [];
  for (const [index, rawPost] of posts.entries()) {
    if (!rawPost || typeof rawPost !== "object") {
      continue;
    }

    const post = rawPost as {
      shortcode?: string;
      mediaType?: string;
      likeCount?: number;
      commentCount?: number;
      playCount?: number;
      takenAt?: string;
      url?: string;
      caption?: string;
    };

    const meta = [
      typeof post.shortcode === "string" ? post.shortcode : undefined,
      typeof post.mediaType === "string" ? post.mediaType : undefined,
      typeof post.likeCount === "number" ? `${post.likeCount} likes` : undefined,
      typeof post.commentCount === "number" ? `${post.commentCount} comments` : undefined,
      typeof post.playCount === "number" ? `${post.playCount} plays` : undefined,
      typeof post.takenAt === "string" ? post.takenAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${post.url ?? "Instagram post"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof post.caption === "string" && post.caption.length > 0) {
      const preview = post.caption.length > 180 ? `${post.caption.slice(0, 180)}...` : post.caption;
      console.log(`   ${preview.replace(/\s+/g, " ").trim()}`);
    }
  }
}

function printInstagramStoriesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const stories = Array.isArray(result.data?.stories) ? result.data.stories : [];
  for (const [index, rawStory] of stories.entries()) {
    if (!rawStory || typeof rawStory !== "object") {
      continue;
    }

    const story = rawStory as {
      mediaType?: string;
      takenAt?: string;
      expiresAt?: string;
      url?: string;
      assetUrl?: string;
    };

    const meta = [
      typeof story.mediaType === "string" ? story.mediaType : undefined,
      typeof story.takenAt === "string" ? story.takenAt : undefined,
      typeof story.expiresAt === "string" ? `expires ${story.expiresAt}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${story.url ?? "Instagram story"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof story.assetUrl === "string" && story.assetUrl.length > 0) {
      console.log(`   asset: ${story.assetUrl}`);
    }
  }
}

function printInstagramMediaResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.ownerUsername === "string" ? `@${data.ownerUsername}` : undefined,
    typeof data.mediaType === "string" ? data.mediaType : undefined,
    typeof data.likeCount === "number" ? `${data.likeCount} likes` : undefined,
    typeof data.commentCount === "number" ? `${data.commentCount} comments` : undefined,
    typeof data.playCount === "number" ? `${data.playCount} plays` : undefined,
    typeof data.takenAt === "string" ? data.takenAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.ownerUrl === "string") {
    console.log(`owner: ${data.ownerUrl}`);
  }

  if (typeof data.caption === "string" && data.caption.length > 0) {
    const preview = data.caption.length > 300 ? `${data.caption.slice(0, 300)}...` : data.caption;
    console.log(preview);
  }
}

function printInstagramProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.fullName === "string" ? data.fullName : undefined,
    typeof data.followerCount === "number" ? `${data.followerCount} followers` : undefined,
    typeof data.followingCount === "number" ? `${data.followingCount} following` : undefined,
    typeof data.mediaCount === "number" ? `${data.mediaCount} posts` : undefined,
    data.isVerified ? "verified" : undefined,
    data.isPrivate ? "private" : "public",
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.externalUrl === "string" && data.externalUrl.length > 0) {
    console.log(`external: ${data.externalUrl}`);
  }

  if (typeof data.biography === "string" && data.biography.length > 0) {
    const preview = data.biography.length > 300 ? `${data.biography.slice(0, 300)}...` : data.biography;
    console.log(preview);
  }
}

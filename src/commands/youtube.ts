import { Command } from "commander";

import { YouTubeAdapter } from "../adapters/youtube.js";
import { Logger } from "../logger.js";
import { printJson } from "../utils/output.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../utils/cli.js";

import type { AdapterActionResult } from "../types.js";

const adapter = new YouTubeAdapter();

export function createYouTubeCommand(): Command {
  const command = new Command("youtube")
    .alias("yt")
    .description("Interact with YouTube using an imported browser session")
    .addHelpText(
      "afterAll",
      `
Examples:
  autocli youtube login --cookies ./youtube.cookies.json
  autocli youtube download dQw4w9WgXcQ
  autocli youtube download dQw4w9WgXcQ --audio-only
  autocli youtube search "rick astley"
  autocli youtube videoid dQw4w9WgXcQ
  autocli youtube channelid @RickAstleyYT
  autocli youtube playlistid PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI
  autocli youtube related dQw4w9WgXcQ
  autocli youtube captions dQw4w9WgXcQ
  autocli youtube like https://www.youtube.com/watch?v=dQw4w9WgXcQ
  autocli youtube subscribe @RickAstleyYT
`,
    );

  command
    .command("login")
    .description("Import cookies and save the YouTube session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the default session name")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing YouTube session...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube session imported.",
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
    .command("download <target>")
    .description("Download a YouTube video or audio track using yt-dlp and ffmpeg")
    .option("--output-dir <path>", "Directory to write downloaded files into")
    .option("--filename <template>", "yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'")
    .option("--audio-only", "Extract audio only instead of video + audio")
    .option("--audio-format <format>", "Audio format when using --audio-only (default: mp3)")
    .option("--format <selector>", "Custom yt-dlp format selector")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Downloading YouTube media...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube download completed.",
        action: () =>
          adapter.download({
            account: options.account,
            target,
            outputDir: options.outputDir,
            filenameTemplate: options.filename,
            audioOnly: options.audioOnly,
            audioFormat: options.audioFormat,
            format: options.format,
          }),
        onSuccess: (result) => {
          printYouTubeDownloadResult(result, ctx.json);
        },
      });
    });

  command
    .command("upload <mediaPath>")
    .description("Upload a YouTube video with the saved session")
    .option("--caption <text>", "Optional title or description text for a future upload flow")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (mediaPath, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Checking YouTube upload support...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube upload completed.",
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
    .command("post <text>")
    .description("YouTube text posting is not implemented in this CLI")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Checking YouTube posting support...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube action completed.",
        action: () =>
          adapter.postText({
            account: options.account,
            text,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("search <query>")
    .description("Search YouTube videos")
    .option("--limit <number>", "Maximum number of results to return (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (query, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Searching YouTube...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube search completed.",
        action: () =>
          adapter.search({
            account: options.account,
            query,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printYouTubeSearchResult(result, ctx.json);
        },
      });
    });

  command
    .command("videoid <target>")
    .alias("info")
    .description("Load exact YouTube video details by URL or 11-character video ID")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading YouTube video details...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube video details loaded.",
        action: () =>
          adapter.info({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printYouTubeInfoResult(result, ctx.json);
        },
      });
    });

  command
    .command("channelid <target>")
    .alias("channel")
    .description("Load exact YouTube channel details by URL, @handle, or UC... channel ID")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading YouTube channel details...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube channel details loaded.",
        action: () =>
          adapter.channelInfo({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printYouTubeChannelResult(result, ctx.json);
        },
      });
    });

  command
    .command("playlistid <target>")
    .alias("playlist")
    .description("Load exact YouTube playlist details by URL or playlist ID")
    .option("--limit <number>", "Maximum number of playlist items to show (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading YouTube playlist details...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube playlist details loaded.",
        action: () =>
          adapter.playlistInfo({
            account: options.account,
            target,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printYouTubePlaylistResult(result, ctx.json);
        },
      });
    });

  command
    .command("related <target>")
    .description("Load related YouTube videos for a given video URL or ID")
    .option("--limit <number>", "Maximum number of related videos to return (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading related YouTube videos...");
      await runCommandAction({
        spinner,
        successMessage: "Related YouTube videos loaded.",
        action: () =>
          adapter.related({
            account: options.account,
            target,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printYouTubeSearchResult(result, ctx.json);
        },
      });
    });

  command
    .command("captions <target>")
    .description("List available YouTube caption tracks for a video URL or ID")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading YouTube caption tracks...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube caption tracks loaded.",
        action: () =>
          adapter.captions({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printYouTubeCaptionsResult(result, ctx.json);
        },
      });
    });

  command
    .command("like <target>")
    .description("Like a YouTube video by URL or 11-character video ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking YouTube video...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube video liked.",
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
    .command("dislike <target>")
    .description("Dislike a YouTube video by URL or 11-character video ID")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Disliking YouTube video...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube video disliked.",
        action: () =>
          adapter.dislike({
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
    .description("Clear the current like/dislike state for a YouTube video")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Clearing YouTube video preference...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube video preference cleared.",
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
    .description("Comment on a YouTube video by URL or 11-character video ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending YouTube comment...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube comment sent.",
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
    .command("subscribe <target>")
    .description("Subscribe to a YouTube channel by URL, @handle, or UC... channel ID")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Subscribing to YouTube channel...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube channel subscribed.",
        action: () =>
          adapter.subscribe({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("unsubscribe <target>")
    .description("Unsubscribe from a YouTube channel by URL, @handle, or UC... channel ID")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Unsubscribing from YouTube channel...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube channel unsubscribed.",
        action: () =>
          adapter.unsubscribe({
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

function printYouTubeSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  if (results.length === 0) {
    return;
  }

  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      title?: string;
      channel?: string;
      duration?: string;
      views?: string;
      published?: string;
      url?: string;
    };

    const meta = [item.channel, item.views, item.published, item.duration].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    console.log(`${index + 1}. ${item.title ?? "Untitled video"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

function printYouTubeDownloadResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  if (typeof data.outputPath === "string" && data.outputPath.length > 0) {
    console.log(`file: ${data.outputPath}`);
  }

  const meta = [
    typeof data.audioOnly === "boolean" ? (data.audioOnly ? "audio-only" : "video+audio") : undefined,
    typeof data.audioFormat === "string" ? data.audioFormat : undefined,
    typeof data.format === "string" ? data.format : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
}

function printYouTubeInfoResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const channel = typeof data.channel === "string" ? data.channel : undefined;
  const published = typeof data.published === "string" ? data.published : undefined;
  const views = typeof data.views === "string" ? data.views : undefined;
  const duration = typeof data.duration === "string" ? data.duration : undefined;
  const category = typeof data.category === "string" ? data.category : undefined;
  const channelUrl = typeof data.channelUrl === "string" ? data.channelUrl : undefined;
  const description = typeof data.description === "string" ? data.description : undefined;

  const meta = [channel, views, published, duration, category].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (channelUrl) {
    console.log(`channel: ${channelUrl}`);
  }

  if (description) {
    const preview = description.length > 300 ? `${description.slice(0, 300)}...` : description;
    console.log(preview);
  }
}

function printYouTubeChannelResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.handle, data.subscriberCount].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.rssUrl === "string") {
    console.log(`rss: ${data.rssUrl}`);
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 300 ? `${data.description.slice(0, 300)}...` : data.description;
    console.log(preview);
  }
}

function printYouTubePlaylistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.videoCount, data.viewCount, data.updated].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const items = Array.isArray(data.items) ? data.items : [];
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      title?: string;
      channel?: string;
      duration?: string;
      url?: string;
    };

    const itemMeta = [item.channel, item.duration].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    console.log(`${index + 1}. ${item.title ?? "Untitled video"}`);
    if (itemMeta.length > 0) {
      console.log(`   ${itemMeta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

function printYouTubeCaptionsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  const tracks = data && typeof data === "object" && Array.isArray(data.tracks) ? data.tracks : [];
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      language?: string;
      languageCode?: string;
      autoGenerated?: boolean;
      kind?: string;
      isTranslatable?: boolean;
    };

    const meta = [
      track.languageCode,
      track.autoGenerated ? "auto-generated" : undefined,
      track.kind,
      track.isTranslatable ? "translatable" : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${track.language ?? "Unknown language"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}

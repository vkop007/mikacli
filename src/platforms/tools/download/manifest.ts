import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { MikaCliError } from "../../../errors.js";
import { serializeCliError } from "../../../utils/error-recovery.js";
import { readBatchTargets } from "../../../utils/batch.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDownloadBatchResult, printDownloadResult } from "./output.js";
import { downloadToolsAdapter, normalizeYouTubeChannelVideosUrl } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "mikacli tools download stream https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "mikacli tools download info 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' --playlist --limit 5",
  "mikacli tools download channel @RickAstleyYT --mode info --limit 5",
  "mikacli tools download channel @RickAstleyYT --limit 10",
  "mikacli tools download video https://www.youtube.com/watch?v=dQw4w9WgXcQ --quality 720p",
  "mikacli tools download video 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' --playlist --limit 3",
  "mikacli tools download audio https://www.youtube.com/watch?v=dQw4w9WgXcQ --audio-format mp3",
  "mikacli tools download batch ./urls.txt --mode video --quality 720p",
  "mikacli tools download video https://x.com/user/status/123 --platform x",
  "mikacli tools download video https://www.instagram.com/reel/abc123/ --platform instagram --account jieunyourgirl",
] as const;

function buildDownloadCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("download").description("Download media from most sites supported by yt-dlp, with optional MikaCLI session cookies");

  command.addCommand(buildInfoCommand());
  command.addCommand(buildStreamCommand());
  command.addCommand(buildChannelCommand());
  command.addCommand(buildVideoCommand());
  command.addCommand(buildAudioCommand());
  command.addCommand(buildBatchCommand());
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  return command;
}

function buildStreamCommand(): Command {
  const command = new Command("stream").description("Resolve a direct media stream URL instead of downloading the file");
  command.argument("<url>", "Media URL to resolve");
  addAuthOptions(command);
  command.option("--quality <resolution>", "Preferred max resolution for a single-file video stream, for example 720p or 1080");
  command.option("--format <selector>", "Custom yt-dlp format selector");
  command.option("--audio", "Resolve an audio stream URL instead of a video stream URL");
  command.action(async (url: string, input: DownloadCommandOptions, cmd: Command) => {
    await runDownloadAction(cmd, "Resolving stream URL...", "Stream URL resolved.", () =>
      downloadToolsAdapter.stream({
        url,
        cookiesPath: input.cookies,
        sessionPlatform: input.platform,
        account: input.account,
        quality: input.quality,
        format: input.format,
        audioOnly: Boolean(input.audio),
      }));
  });
  return command;
}

function buildInfoCommand(): Command {
  const command = new Command("info").description("Inspect media info and available formats for a URL");
  command.argument("<url>", "Media URL to inspect");
  addAuthOptions(command);
  addPlaylistOptions(command);
  command.action(async (url: string, input: DownloadCommandOptions, cmd: Command) => {
    await runDownloadAction(cmd, "Loading media info...", "Media info loaded.", () =>
      downloadToolsAdapter.info({
        url,
        cookiesPath: input.cookies,
        sessionPlatform: input.platform,
        account: input.account,
        playlist: Boolean(input.playlist),
        limit: input.limit,
      }));
  });
  return command;
}

function buildChannelCommand(): Command {
  const command = new Command("channel").description("Inspect or download all videos from a YouTube channel automatically");
  command.argument("<target>", "YouTube channel URL, @handle, or UC... channel ID");
  command.option("--mode <mode>", "Channel mode: info, video, or audio", parseBatchMode, "video");
  addAuthOptions(command);
  addOutputOptions(command);
  command.option("--limit <number>", "Maximum channel videos to inspect or download (1-100)", parsePositiveInteger);
  command.option("--quality <resolution>", "Preferred max resolution in video mode, for example 720p or 1080");
  command.option("--format <selector>", "Custom yt-dlp format selector");
  command.option("--audio-format <format>", "Extracted audio format in audio mode (default: mp3)", "mp3");
  command.action(async (target: string, input: DownloadCommandOptions, cmd: Command) => {
    const channelUrl = normalizeYouTubeChannelVideosUrl(target);
    await runDownloadAction(
      cmd,
      input.mode === "info"
        ? "Loading YouTube channel videos..."
        : input.mode === "audio"
          ? "Downloading YouTube channel audio..."
          : "Downloading YouTube channel videos...",
      input.mode === "info"
        ? "YouTube channel videos loaded."
        : input.mode === "audio"
          ? "YouTube channel audio download completed."
          : "YouTube channel video download completed.",
      () => executeBatchTarget(channelUrl, { ...input, playlist: true }, parseBatchMode(input.mode ?? "video")),
    );
  });
  return command;
}

function buildVideoCommand(): Command {
  const command = new Command("video").description("Download video from a supported URL");
  command.argument("<url>", "Media URL to download");
  addAuthOptions(command);
  addOutputOptions(command);
  addPlaylistOptions(command);
  command.option("--quality <resolution>", "Preferred max resolution, for example 720p or 1080");
  command.option("--format <selector>", "Custom yt-dlp format selector");
  command.action(async (url: string, input: DownloadCommandOptions, cmd: Command) => {
    await runDownloadAction(cmd, "Downloading video...", "Video download completed.", () =>
      downloadToolsAdapter.video({
        url,
        cookiesPath: input.cookies,
        sessionPlatform: input.platform,
        account: input.account,
        outputDir: input.outputDir,
        filenameTemplate: input.filename,
        quality: input.quality,
        format: input.format,
        playlist: Boolean(input.playlist),
        limit: input.limit,
      }));
  });
  return command;
}

function buildAudioCommand(): Command {
  const command = new Command("audio").description("Download audio from a supported URL");
  command.argument("<url>", "Media URL to download");
  addAuthOptions(command);
  addOutputOptions(command);
  addPlaylistOptions(command);
  command.option("--audio-format <format>", "Extracted audio format (default: mp3)", "mp3");
  command.option("--format <selector>", "Custom yt-dlp format selector");
  command.action(async (url: string, input: DownloadCommandOptions, cmd: Command) => {
    await runDownloadAction(cmd, "Downloading audio...", "Audio download completed.", () =>
      downloadToolsAdapter.audio({
        url,
        cookiesPath: input.cookies,
        sessionPlatform: input.platform,
        account: input.account,
        outputDir: input.outputDir,
        filenameTemplate: input.filename,
        audioFormat: input.audioFormat,
        format: input.format,
        playlist: Boolean(input.playlist),
        limit: input.limit,
      }));
  });
  return command;
}

function buildBatchCommand(): Command {
  const command = new Command("batch").description("Run yt-dlp info or downloads for a newline-delimited or JSON array input file");
  command.argument("<inputFile>", "Path to a newline-delimited file or JSON array of media URLs");
  command.option("--mode <mode>", "Batch mode: info, video, or audio", parseBatchMode, "video");
  addAuthOptions(command);
  addOutputOptions(command);
  addPlaylistOptions(command);
  command.option("--quality <resolution>", "Preferred max resolution in video mode, for example 720p or 1080");
  command.option("--format <selector>", "Custom yt-dlp format selector");
  command.option("--audio-format <format>", "Extracted audio format in audio mode (default: mp3)", "mp3");
  command.option("--fail-fast", "Stop after the first failed URL");
  command.action(async (inputFile: string, input: DownloadCommandOptions, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Running batch download...");

    await runCommandAction({
      spinner,
      successMessage: "Batch download completed.",
      action: async () => runDownloadBatch(inputFile, input, ctx),
      onSuccess: (result) => printDownloadBatchResult(result, ctx.json),
    });
  });

  return command;
}

async function runDownloadAction(
  cmd: Command,
  spinnerText: string,
  successMessage: string,
  action: () => Promise<Awaited<ReturnType<typeof downloadToolsAdapter.info>>>,
): Promise<void> {
  const ctx = resolveCommandContext(cmd);
  const logger = new Logger(ctx);
  const spinner = logger.spinner(spinnerText);

  await runCommandAction({
    spinner,
    successMessage,
    action,
    onSuccess: (result) => printDownloadResult(result, ctx.json),
  });
}

async function runDownloadBatch(
  inputFile: string,
  input: DownloadCommandOptions,
  ctx: { json: boolean; verbose: boolean },
): Promise<AdapterActionResult> {
  const { inputPath, targets } = await readBatchTargets(inputFile);
  const mode = parseBatchMode(input.mode ?? "video");
  const results: Array<{
    target: string;
    ok: boolean;
    message?: string;
    code?: string;
    id?: string;
    url?: string;
    outputPath?: string;
    details?: Record<string, unknown>;
  }> = [];

  for (const target of targets) {
    try {
      const result = await executeBatchTarget(target, input, mode);
      results.push({
        target,
        ok: true,
        message: result.message,
        id: result.id,
        url: result.url,
        outputPath: typeof result.data?.outputPath === "string" ? result.data.outputPath : undefined,
      });
    } catch (error) {
      const serialized = serializeCliError(error).error;
      results.push({
        target,
        ok: false,
        code: serialized.code,
        message: serialized.message,
        details: serialized.details,
      });

      if (input.failFast) {
        break;
      }
    }
  }

  const failed = results.filter((result) => !result.ok).length;
  const succeeded = results.length - failed;
  if (failed > 0) {
    process.exitCode = 1;
  }

  return {
    ok: true,
    platform: "download",
    account:
      input.platform?.trim() && input.account?.trim()
        ? `${input.platform.trim()}:${input.account.trim()}`
        : input.platform?.trim() || (input.cookies ? "cookies" : "public"),
    action: "batch",
    message:
      failed === 0
        ? `Batch ${mode} completed for ${succeeded} URL${succeeded === 1 ? "" : "s"}.`
        : `Batch ${mode} completed with ${failed} failure${failed === 1 ? "" : "s"}.`,
    data: {
      inputPath,
      mode,
      requested: targets.length,
      processed: results.length,
      succeeded,
      failed,
      failFast: Boolean(input.failFast),
      results: ctx.verbose
        ? results
        : results.map((result) => ({
          target: result.target,
          ok: result.ok,
          message: result.message,
          code: result.code,
          id: result.id,
          url: result.url,
          outputPath: result.outputPath,
        })),
    },
  };
}

async function executeBatchTarget(
  target: string,
  input: DownloadCommandOptions,
  mode: DownloadBatchMode,
): Promise<AdapterActionResult> {
  const shared = {
    cookiesPath: input.cookies,
    sessionPlatform: input.platform,
    account: input.account,
  };

  switch (mode) {
    case "info":
      return downloadToolsAdapter.info({
        url: target,
        ...shared,
        playlist: Boolean(input.playlist),
        limit: input.limit,
      });
    case "audio":
      return downloadToolsAdapter.audio({
        url: target,
        ...shared,
        outputDir: input.outputDir,
        filenameTemplate: input.filename,
        audioFormat: input.audioFormat,
        format: input.format,
        playlist: Boolean(input.playlist),
        limit: input.limit,
      });
    case "video":
      return downloadToolsAdapter.video({
        url: target,
        ...shared,
        outputDir: input.outputDir,
        filenameTemplate: input.filename,
        quality: input.quality,
        format: input.format,
        playlist: Boolean(input.playlist),
        limit: input.limit,
      });
    default:
      throw new MikaCliError("DOWNLOAD_BATCH_MODE_INVALID", `Unknown batch mode "${mode}".`);
  }
}

function addAuthOptions(command: Command): void {
  command.option("--cookies <path>", "Path to cookies.txt or a yt-dlp-compatible cookies file");
  command.option("--platform <provider>", "Reuse a saved MikaCLI session for this provider as yt-dlp cookies");
  command.option("--account <name>", "Saved MikaCLI session account to use with --platform");
}

function addOutputOptions(command: Command): void {
  command.option("--output-dir <path>", "Directory to save downloaded files");
  command.option("--filename <template>", "yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'");
}

function addPlaylistOptions(command: Command): void {
  command.option("--playlist", "Allow playlist or multi-item URLs instead of forcing a single item");
  command.option("--limit <number>", "Maximum playlist items to inspect or download (1-100)", parsePositiveInteger);
}

type DownloadCommandOptions = {
  cookies?: string;
  platform?: string;
  account?: string;
  outputDir?: string;
  filename?: string;
  format?: string;
  quality?: string;
  audioFormat?: string;
  audio?: boolean;
  mode?: DownloadBatchMode;
  failFast?: boolean;
  playlist?: boolean;
  limit?: number;
};

type DownloadBatchMode = "info" | "video" | "audio";

function parseBatchMode(value: string): DownloadBatchMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "info" || normalized === "video" || normalized === "audio") {
    return normalized;
  }

  throw new Error('Expected --mode to be one of: info, video, audio.');
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer "${value}".`);
  }

  return parsed;
}

export const downloadPlatformDefinition: PlatformDefinition = {
  id: "download" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Download",
  description: "Download media from most URLs supported by yt-dlp, with optional saved-session cookies from MikaCLI",
  authStrategies: ["none", "cookies"],
  buildCommand: buildDownloadCommand,
  adapter: downloadToolsAdapter,
  examples: EXAMPLES,
};

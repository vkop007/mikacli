import { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { printJson } from "../../../../utils/output.js";
import { serializeCliError } from "../../../../utils/error-recovery.js";
import { readBatchTargets } from "../../../../utils/batch.js";
import { resolveCommandContext } from "../../../../utils/cli.js";
import { instagramAdapter } from "../adapter.js";
import { parseInstagramLimitOption, parseInstagramPostTypeOption } from "../options.js";

import type { AdapterActionResult } from "../../../../types.js";
import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

async function runInstagramBatchCommand(input: {
  ctx: { json: boolean; verbose: boolean };
  inputFile: string;
  account?: string;
  failFast?: boolean;
  action: string;
  actionLabel: string;
  execute: (target: string) => Promise<AdapterActionResult>;
}): Promise<void> {
  const logger = new Logger(input.ctx);
  const spinner = logger.spinner(`${input.actionLabel}...`);

  try {
    const { inputPath, targets } = await readBatchTargets(input.inputFile);
    const results: Array<{
      target: string;
      ok: boolean;
      message?: string;
      code?: string;
      id?: string;
      url?: string;
      details?: Record<string, unknown>;
    }> = [];

    for (const target of targets) {
      try {
        const result = await input.execute(target);
        results.push({
          target,
          ok: true,
          message: result.message,
          id: result.id,
          url: result.url,
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
    const summary = {
      ok: failed === 0,
      platform: "instagram",
      account: input.account ?? "latest",
      action: input.action,
      message:
        failed === 0
          ? `${input.actionLabel} completed for ${succeeded} target${succeeded === 1 ? "" : "s"}.`
          : `${input.actionLabel} completed with ${failed} failure${failed === 1 ? "" : "s"}.`,
      data: {
        inputPath,
        requested: targets.length,
        processed: results.length,
        succeeded,
        failed,
        failFast: Boolean(input.failFast),
        results,
      },
    };

    spinner?.stop();

    if (input.ctx.json) {
      printJson(summary);
    } else {
      console.log(summary.message);
      console.log(`input: ${inputPath}`);
      for (const result of results) {
        if (result.ok) {
          console.log(`ok   ${result.target}`);
          if (result.message) {
            console.log(`     ${result.message}`);
          }
          if (result.url) {
            console.log(`     ${result.url}`);
          }
        } else {
          console.log(`fail ${result.target}`);
          console.log(`     ${result.code ?? "ERROR"}: ${result.message ?? "Unknown error"}`);
          if (result.details && Object.keys(result.details).length > 0 && input.ctx.verbose) {
            console.log(`     ${JSON.stringify(result.details)}`);
          }
        }
      }
    }

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    spinner?.stop();
    throw error;
  }
}

export const instagramBatchCapability: PlatformCapability = {
  id: "batch",
  register(command: Command) {
    const batchCommand = command
      .command("batch")
      .description("Run Instagram actions from a newline-delimited or JSON array input file");

    batchCommand
      .command("like <inputFile>")
      .description("Like Instagram posts from a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-like",
          actionLabel: "Instagram batch like",
          execute: (target) => instagramAdapter.like({ account: options.account, target }),
        });
      });

    batchCommand
      .command("unlike <inputFile>")
      .description("Unlike Instagram posts from a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-unlike",
          actionLabel: "Instagram batch unlike",
          execute: (target) => instagramAdapter.unlike({ account: options.account, target }),
        });
      });

    batchCommand
      .command("follow <inputFile>")
      .description("Follow Instagram profiles from a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-follow",
          actionLabel: "Instagram batch follow",
          execute: (target) => instagramAdapter.follow({ account: options.account, target }),
        });
      });

    batchCommand
      .command("unfollow <inputFile>")
      .description("Unfollow Instagram profiles from a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-unfollow",
          actionLabel: "Instagram batch unfollow",
          execute: (target) => instagramAdapter.unfollow({ account: options.account, target }),
        });
      });

    batchCommand
      .command("comment <inputFile> <text>")
      .description("Send the same Instagram comment to every target in a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, text, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-comment",
          actionLabel: "Instagram batch comment",
          execute: (target) => instagramAdapter.comment({ account: options.account, target, text }),
        });
      });

    batchCommand
      .command("download <inputFile>")
      .description("Download Instagram media for every target in a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--output-dir <path>", "Directory to write downloaded files into")
      .option("--all", "Download every asset in carousel posts instead of only the first one")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-download",
          actionLabel: "Instagram batch download",
          execute: (target) =>
            instagramAdapter.download({
              account: options.account,
              target,
              outputDir: options.outputDir,
              all: options.all,
            }),
        });
      });

    batchCommand
      .command("storydownload <inputFile>")
      .description("Download Instagram stories for every profile in a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--limit <number>", "Maximum number of story items to download per profile (1-25, default: 5)", parseInstagramLimitOption)
      .option("--output-dir <path>", "Directory to write downloaded story files into")
      .option("--photos-only", "Only download photo stories")
      .option("--videos-only", "Only download video stories")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-storydownload",
          actionLabel: "Instagram batch story download",
          execute: (target) =>
            instagramAdapter.storyDownload({
              account: options.account,
              target,
              limit: options.limit,
              outputDir: options.outputDir,
              photosOnly: options.photosOnly,
              videosOnly: options.videosOnly,
            }),
        });
      });

    batchCommand
      .command("downloadposts <inputFile>")
      .description("Download recent Instagram posts for every profile in a batch input file")
      .option("--account <name>", "Optional override for a specific saved Instagram session")
      .option("--limit <number>", "Maximum number of posts to download per profile (1-25, default: 5)", parseInstagramLimitOption)
      .option("--type <kind>", "Filter posts by media type: all, photo, video, reel, carousel", parseInstagramPostTypeOption)
      .option("--output-dir <path>", "Directory to write downloaded post files into")
      .option("--all", "Download every asset in carousel posts instead of only the first one")
      .option("--fail-fast", "Stop after the first failed target")
      .action(async (inputFile, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        await runInstagramBatchCommand({
          ctx,
          inputFile,
          account: options.account,
          failFast: options.failFast,
          action: "batch-downloadposts",
          actionLabel: "Instagram batch post download",
          execute: (target) =>
            instagramAdapter.downloadPosts({
              account: options.account,
              target,
              limit: options.limit,
              type: options.type,
              outputDir: options.outputDir,
              all: options.all,
            }),
        });
      });
  },
};

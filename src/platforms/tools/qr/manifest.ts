import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { qrAdapter } from "./adapter.js";
import { qrCapabilities } from "./capabilities/index.js";
import { printQrResult } from "./output.js";
import { parsePositiveInteger } from "./helpers.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  'mikacli tools qr encode "https://example.com"',
  'mikacli tools qr encode "https://example.com" --size 8 --margin 4',
  'mikacli tools qr decode ./qr-image.png --json',
] as const;

function buildQrCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("qr").description("Generate QR codes and decode QR images");

  // Encode command (default behavior for backward compatibility)
  const encodeCommand = new Command("encode").description("Generate a QR code from text");
  encodeCommand.argument("<text...>", "Text or URL to encode");
  encodeCommand.option("--size <number>", "QR image size hint", (value) => parsePositiveInteger(value, "size"), 6);
  encodeCommand.option("--margin <number>", "QR image margin in modules", (value) => parsePositiveInteger(value, "margin"), 2);
  encodeCommand.option("--url", "Print a public image URL too");

  encodeCommand.action(async (text: string[] | string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Generating QR code...");

    await runCommandAction({
      spinner,
      successMessage: "QR code generated.",
      action: () =>
        qrAdapter.generate({
          text: Array.isArray(text) ? text.join(" ") : String(text ?? ""),
          size: options.size as number | undefined,
          margin: options.margin as number | undefined,
          includeUrl: Boolean(options.url),
        }),
      onSuccess: (result) => printQrResult(result, ctx.json),
    });
  });

  // Decode command
  const decodeCommand = new Command("decode").description("Decode a QR code from an image file");
  decodeCommand.argument("<filePath>", "Path to QR code image file");

  decodeCommand.action(async (filePath: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Decoding QR code...");

    await runCommandAction({
      spinner,
      successMessage: "QR code decoded.",
      action: () => qrAdapter.decode({ filePath }),
      onSuccess: (result) => printQrResult(result, ctx.json),
    });
  });

  command.addCommand(encodeCommand);
  command.addCommand(decodeCommand);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  // For backward compatibility, also support the old direct argument style
  command.argument("[text...]", "Text or URL to encode (deprecated, use 'encode' command)");
  command.option("--size <number>", "QR image size hint", (value) => parsePositiveInteger(value, "size"), 6);
  command.option("--margin <number>", "QR image margin in modules", (value) => parsePositiveInteger(value, "margin"), 2);
  command.option("--url", "Print a public image URL too");

  command.action(async (text: string[] | string | undefined, options: Record<string, unknown>, cmd: Command) => {
    // Only handle if text is provided and no subcommand was used
    if (!text || (Array.isArray(text) && text.length === 0)) {
      return;
    }

    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Generating QR code...");

    await runCommandAction({
      spinner,
      successMessage: "QR code generated.",
      action: () =>
        qrAdapter.generate({
          text: Array.isArray(text) ? text.join(" ") : String(text ?? ""),
          size: options.size as number | undefined,
          margin: options.margin as number | undefined,
          includeUrl: Boolean(options.url),
        }),
      onSuccess: (result) => printQrResult(result, ctx.json),
    });
  });

  return command;
}

export const qrPlatformDefinition: PlatformDefinition = {
  id: "qr",
  category: "tools",
  displayName: "QR",
  description: "Generate QR codes and decode QR images without any account setup",
  aliases: [],
  authStrategies: ["none"],
  buildCommand: buildQrCommand,
  adapter: qrAdapter,
  capabilities: qrCapabilities,
  examples: EXAMPLES,
};

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
  'autocli qr "https://example.com"',
  'autocli qr "https://example.com" --size 8 --margin 4',
  'autocli qr "hello world" --url',
] as const;

function buildQrCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("qr").description("Generate shareable QR codes without any account setup");
  command.argument("<text...>", "Text or URL to encode");
  command.option("--size <number>", "QR image size hint", (value) => parsePositiveInteger(value, "size"), 6);
  command.option("--margin <number>", "QR image margin in modules", (value) => parsePositiveInteger(value, "margin"), 2);
  command.option("--url", "Print a public image URL too");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (text: string[] | string, options: Record<string, unknown>, cmd: Command) => {
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
  description: "Generate shareable QR codes without any account setup",
  aliases: [],
  authStrategies: ["none"],
  buildCommand: buildQrCommand,
  adapter: qrAdapter,
  capabilities: qrCapabilities,
  examples: EXAMPLES,
};

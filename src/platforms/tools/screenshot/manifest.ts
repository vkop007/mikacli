import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { screenshotAdapter } from "./adapter.js";
import { printScreenshotResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli screenshot https://example.com",
  "mikacli screenshot openai.com --output-dir ./shots",
  "mikacli screenshot https://news.ycombinator.com --output ./hn.png",
] as const;

function buildScreenshotCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("screenshot").description("Capture a website screenshot and save it locally");
  command.argument("<target>", "Website URL or hostname");
  command.option("--output <path>", "Write the screenshot to an exact file path");
  command.option("--output-dir <path>", "Directory to write the screenshot into");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 25000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(
    async (
      target: string,
      input: { output?: string; outputDir?: string; timeout: number },
      cmd: Command,
    ) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Capturing screenshot...");

      await runCommandAction({
        spinner,
        successMessage: "Screenshot captured.",
        action: () =>
          screenshotAdapter.screenshot({
            target,
            output: input.output,
            outputDir: input.outputDir,
            timeoutMs: input.timeout,
          }),
        onSuccess: (result) => printScreenshotResult(result, ctx.json),
      });
    },
  );

  return command;
}

export const screenshotPlatformDefinition: PlatformDefinition = {
  id: "screenshot",
  category: "tools",
  displayName: "Screenshot",
  description: "Capture a website screenshot using a public no-key rendering service",
  authStrategies: ["none"],
  buildCommand: buildScreenshotCommand,
  adapter: screenshotAdapter,
  examples: EXAMPLES,
};

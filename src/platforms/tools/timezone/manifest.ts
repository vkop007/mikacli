import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { timezoneAdapter } from "./adapter.js";
import { printTimezoneResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli timezone Asia/Kolkata",
  'autocli timezone "Mumbai"',
  "autocli timezone 19.0760,72.8777",
  "autocli timezone --lat 40.7128 --lon -74.0060 --json",
] as const;

function buildTimezoneCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("timezone").description("Resolve timezone metadata from a place, coordinates, or an IANA zone name");
  command.argument("[target]", "Place name, IANA timezone, or coordinates like 19.0760,72.8777");
  command.option("--lat <number>", "Latitude", (value) => Number.parseFloat(value));
  command.option("--lon <number>", "Longitude", (value) => Number.parseFloat(value));
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string | undefined, input: { lat?: number; lon?: number; timeout: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Resolving timezone...");

    await runCommandAction({
      spinner,
      successMessage: "Timezone resolved.",
      action: () =>
        timezoneAdapter.inspect({
          target,
          lat: input.lat,
          lon: input.lon,
          timeoutMs: input.timeout,
        }),
      onSuccess: (result) => printTimezoneResult(result, ctx.json),
    });
  });

  return command;
}

export const timezonePlatformDefinition: PlatformDefinition = {
  id: "timezone" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Timezone",
  description: "Resolve timezone metadata from a place, coordinates, or an IANA timezone",
  authStrategies: ["none"],
  buildCommand: buildTimezoneCommand,
  adapter: timezoneAdapter,
  examples: EXAMPLES,
};

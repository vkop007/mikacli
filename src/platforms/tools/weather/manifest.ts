import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { weatherAdapter } from "./adapter.js";
import { weatherCapabilities } from "./capabilities/index.js";
import { printWeatherResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli weather",
  "mikacli weather London",
  'mikacli weather "San Francisco" --days 3',
  "mikacli weather Tokyo --lang ja",
] as const;

function buildWeatherCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("weather").description("Get current conditions and short forecast from wttr.in");
  command.argument("[location]", "Optional location, defaults to auto-detect by IP");
  command.option("--days <number>", "Forecast days to include (1-3, default: 1)", parseDayCount, 1);
  command.option("--lang <code>", "Response language code, for example en, es, fr, hi");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (location: string | undefined, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading weather...");

    await runCommandAction({
      spinner,
      successMessage: "Weather loaded.",
      action: () =>
        weatherAdapter.weather({
          location,
          days: options.days as number | undefined,
          lang: options.lang as string | undefined,
        }),
      onSuccess: (result) => printWeatherResult(result, ctx.json),
    });
  });

  return command;
}

function parseDayCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3) {
    throw new Error(`Invalid day count "${value}". Expected an integer between 1 and 3.`);
  }

  return parsed;
}

export const weatherPlatformDefinition: PlatformDefinition = {
  id: "weather",
  category: "tools",
  displayName: "Weather",
  description: "Get weather conditions and forecasts from wttr.in without any account setup",
  authStrategies: ["none"],
  buildCommand: buildWeatherCommand,
  adapter: weatherAdapter,
  capabilities: weatherCapabilities,
  examples: EXAMPLES,
};

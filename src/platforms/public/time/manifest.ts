import { Command } from "commander";

import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { timeAdapter } from "./adapter.js";
import { timeCapabilities } from "./capabilities/index.js";
import { printTimeResult } from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

function buildTimeCommand(): Command {
  const command = new Command("time").description("Show local time by IP or a specific timezone");
  command.argument("[timezone]", "Optional IANA timezone, e.g. Asia/Kolkata");
  command.addHelpText(
    "afterAll",
    `
Examples:
  autocli time
  autocli time Asia/Kolkata
  autocli time America/New_York
`,
  );

  command.action(async (timezone: string | undefined, _options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading time...");

    await runCommandAction({
      spinner,
      successMessage: "Time loaded.",
      action: () =>
        timeAdapter.time({
          timezone,
        }),
      onSuccess: (result) => printTimeResult(result, ctx.json),
    });
  });

  return command;
}

export const timePlatformDefinition: PlatformDefinition = {
  id: "time",
  category: "public",
  displayName: "Time",
  description: "Get local date/time info from worldtimeapi.org by IP or timezone",
  authStrategies: ["none"],
  buildCommand: buildTimeCommand,
  adapter: timeAdapter,
  capabilities: timeCapabilities,
  examples: ["autocli time", "autocli time Asia/Kolkata", "autocli time America/New_York"],
};

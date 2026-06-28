import { Command } from "commander";
import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { jwtAdapter } from "./adapter.js";
import { jwtCapabilities } from "./capabilities/index.js";
import { printJwtResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = ["mikacli tools jwt decode <token>"] as const;

function buildJwtCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("jwt").description("Decode and inspect JSON Web Tokens locally");
  command
    .command("decode")
    .argument("<token>", "JWT string to parse")
    .action(async (token: string, _options: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Decoding token...");

      await runCommandAction({
        spinner,
        successMessage: "Token decoded.",
        action: () => jwtAdapter.decode({ token }),
        onSuccess: (result) => printJwtResult(result, ctx.json),
      });
    });

  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));
  return command;
}

export const jwtPlatformDefinition: PlatformDefinition = {
  id: "jwt" as PlatformDefinition["id"],
  category: "tools",
  displayName: "JWT Analyzer",
  description: "Decode and inspect JSON Web Tokens offline",
  authStrategies: ["none"],
  buildCommand: buildJwtCommand,
  adapter: jwtAdapter,
  capabilities: jwtCapabilities,
  examples: EXAMPLES,
};

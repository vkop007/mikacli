import { Command } from "commander";
import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { jwtAdapter } from "./adapter.js";
import { jwtCapabilities } from "./capabilities/index.js";
import { printJwtResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli tools jwt decode <token>",
  "mikacli tools jwt verify <token> --secret <key>",
  "mikacli tools jwt sign --payload <json> --secret <key>",
  "mikacli tools jwt audit <token>",
] as const;

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

  command
    .command("verify")
    .argument("<token>", "JWT string to verify")
    .option("--secret <key>", "HMAC secret or RSA public key string")
    .option("--key-file <path>", "Path to public key file")
    .action(async (token: string, opts: { secret?: string; keyFile?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Verifying token...");

      await runCommandAction({
        spinner,
        successMessage: "Token verified.",
        action: () => jwtAdapter.verify({ token, secret: opts.secret, keyFile: opts.keyFile }),
        onSuccess: (result) => printJwtResult(result, ctx.json),
      });
    });

  command
    .command("sign")
    .option("--payload <json>", "JSON payload string")
    .option("--secret <key>", "HMAC secret or RSA private key string")
    .option("--key-file <path>", "Path to private key file")
    .option("--alg <algorithm>", "Signing algorithm (default: HS256)")
    .option("--exp <duration>", "Expiration time duration (e.g. 1h, 1d)")
    .action(async (opts: { payload?: string; secret?: string; keyFile?: string; alg?: string; exp?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Signing token...");

      let payload: Record<string, unknown> = {};
      if (opts.payload) {
        try {
          payload = JSON.parse(opts.payload);
        } catch (err) {
          throw new Error(`Invalid JSON payload: ${(err as Error).message}`);
        }
      }

      await runCommandAction({
        spinner,
        successMessage: "Token signed.",
        action: () => jwtAdapter.sign({
          payload,
          secretOrKey: opts.secret,
          keyFile: opts.keyFile,
          algorithm: opts.alg,
          expiresIn: opts.exp,
        }),
        onSuccess: (result) => printJwtResult(result, ctx.json),
      });
    });

  command
    .command("audit")
    .argument("<token>", "JWT string to audit")
    .action(async (token: string, _options: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Auditing token...");

      await runCommandAction({
        spinner,
        successMessage: "Token audited.",
        action: () => jwtAdapter.audit({ token }),
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

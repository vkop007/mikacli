import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { ipAdapter } from "./adapter.js";
import { ipCapabilities } from "./capabilities/index.js";
import { printIpResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = ["autocli ip", "autocli ip --version 4", "autocli ip --version 6", "autocli ip --details"] as const;

function buildIpCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("ip").description("Resolve your public IP address");
  command.option("--version <value>", "IP version preference: 4, 6, any (default: any)", parseIpVersion, "any");
  command.option("--details", "Include country/city/org details when available");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Resolving public IP...");

    await runCommandAction({
      spinner,
      successMessage: "Public IP loaded.",
      action: () =>
        ipAdapter.ip({
          version: options.version as string | undefined,
          details: Boolean(options.details),
        }),
      onSuccess: (result) => printIpResult(result, ctx.json),
    });
  });

  return command;
}

function parseIpVersion(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "4" || normalized === "6" || normalized === "any") {
    return normalized;
  }

  throw new Error(`Invalid version "${value}". Expected one of: 4, 6, any.`);
}

export const ipPlatformDefinition: PlatformDefinition = {
  id: "ip",
  category: "tools",
  displayName: "IP",
  description: "Resolve your public IP address and optional location/network details",
  authStrategies: ["none"],
  buildCommand: buildIpCommand,
  adapter: ipAdapter,
  capabilities: ipCapabilities,
  examples: EXAMPLES,
};

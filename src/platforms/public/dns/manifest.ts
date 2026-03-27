import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { dnsAdapter } from "./adapter.js";
import { dnsCapabilities } from "./capabilities/index.js";
import { printDnsResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = ["autocli dns openai.com", "autocli dns openai.com --type MX"] as const;

function buildDnsCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("dns").description("Resolve DNS records through public DNS-over-HTTPS services");
  command.argument("<name>", "Hostname to resolve");
  command.option("--type <value>", "DNS record type (A, AAAA, MX, TXT, CNAME, etc.)", "A");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (name: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Resolving DNS...");

    await runCommandAction({
      spinner,
      successMessage: "DNS resolved.",
      action: () =>
        dnsAdapter.resolve({
          name,
          type: options.type as string | undefined,
        }),
      onSuccess: (result) => printDnsResult(result, ctx.json),
    });
  });

  return command;
}

export const dnsPlatformDefinition: PlatformDefinition = {
  id: "dns" as PlatformDefinition["id"],
  category: "public",
  displayName: "DNS",
  description: "Resolve DNS records from public DNS-over-HTTPS endpoints without any account setup",
  authStrategies: ["none"],
  buildCommand: buildDnsCommand,
  adapter: dnsAdapter,
  capabilities: dnsCapabilities,
  examples: EXAMPLES,
};

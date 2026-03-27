import { Command } from "commander";

import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { whoisAdapter } from "./adapter.js";
import { whoisCapabilities } from "./capabilities/index.js";
import { printWhoisResult } from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

function buildWhoisCommand(): Command {
  const command = new Command("whois").description("Load WHOIS / RDAP data for a domain or IP address");
  command.argument("<target>", "Domain or IP address to inspect");
  command.addHelpText(
    "afterAll",
    `
Examples:
  autocli whois openai.com
  autocli whois 8.8.8.8
`,
  );

  command.action(async (target: string, _options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading WHOIS data...");

    await runCommandAction({
      spinner,
      successMessage: "WHOIS data loaded.",
      action: () =>
        whoisAdapter.lookup({
          target,
        }),
      onSuccess: (result) => printWhoisResult(result, ctx.json),
    });
  });

  return command;
}

export const whoisPlatformDefinition: PlatformDefinition = {
  id: "whois" as PlatformDefinition["id"],
  category: "public",
  displayName: "Whois",
  description: "Load WHOIS / RDAP data from public no-key endpoints",
  authStrategies: ["none"],
  buildCommand: buildWhoisCommand,
  adapter: whoisAdapter,
  capabilities: whoisCapabilities,
  examples: ["autocli whois openai.com", "autocli whois 8.8.8.8"],
};

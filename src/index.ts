#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";

import packageJson from "../package.json" with { type: "json" };
import { buildPlatformCommand } from "./core/runtime/build-platform-command.js";
import { createStatusCommand } from "./commands/status.js";
import { errorToJson } from "./errors.js";
import { getPlatformDefinitions } from "./platforms/index.js";
import { printJson } from "./utils/output.js";

const HELP_FRAME = `${pc.bold(pc.cyan("AutoCLI"))}
${pc.dim("Browserless social automation from the terminal")}
`;

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("autocli")
    .description("Automate social and developer platforms from the terminal using imported browser sessions and saved API or bot tokens.")
    .version(packageJson.version, "-v, --version", "Show the installed version")
    .option("--json", "Emit machine-readable JSON output")
    .option("--verbose", "Enable verbose logging")
    .showHelpAfterError()
    .addHelpText("beforeAll", `${HELP_FRAME}\n`)
    .addCommand(createStatusCommand());

  for (const definition of getPlatformDefinitions()) {
    program.addCommand(buildPlatformCommand(definition));
  }

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const wantsJson = process.argv.includes("--json");
    if (wantsJson) {
      printJson(errorToJson(error));
      process.exitCode = 1;
      return;
    }

    if (error instanceof Error) {
      console.error(`${pc.red("error")} ${error.message}`);
    } else {
      console.error(`${pc.red("error")} Unknown error`);
    }

    process.exitCode = 1;
  }
}

await main();

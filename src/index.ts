#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";

import packageJson from "../package.json" with { type: "json" };
import { createFacebookCommand } from "./commands/facebook.js";
import { createInstagramCommand } from "./commands/instagram.js";
import { createLinkedInCommand } from "./commands/linkedin.js";
import { createStatusCommand } from "./commands/status.js";
import { createTikTokCommand } from "./commands/tiktok.js";
import { createXCommand } from "./commands/x.js";
import { createYouTubeCommand } from "./commands/youtube.js";
import { errorToJson } from "./errors.js";
import { printJson } from "./utils/output.js";

const HELP_FRAME = `${pc.bold(pc.cyan("AutoCLI"))}
${pc.dim("Browserless social automation from the terminal")}
`;

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("autocli")
    .description("Automate social media platforms from the terminal using imported browser sessions.")
    .version(packageJson.version, "-v, --version", "Show the installed version")
    .option("--json", "Emit machine-readable JSON output")
    .option("--verbose", "Enable verbose logging")
    .showHelpAfterError()
    .addHelpText("beforeAll", `${HELP_FRAME}\n`)
    .addCommand(createStatusCommand())
    .addCommand(createFacebookCommand())
    .addCommand(createInstagramCommand())
    .addCommand(createLinkedInCommand())
    .addCommand(createTikTokCommand())
    .addCommand(createYouTubeCommand())
    .addCommand(createXCommand());

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

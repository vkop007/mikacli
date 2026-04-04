#!/usr/bin/env node

import pc from "picocolors";

import { assertCategoryOnlyInvocation, createProgram } from "./program.js";
import { printJson } from "./utils/output.js";
import { serializeCliError } from "./utils/error-recovery.js";

async function main(): Promise<void> {
  const program = createProgram();

  try {
    assertCategoryOnlyInvocation(process.argv.slice(2));
    await program.parseAsync(process.argv);
  } catch (error) {
    const wantsJson = process.argv.includes("--json");
    const serialized = serializeCliError(error);
    if (wantsJson) {
      printJson(serialized);
      process.exitCode = 1;
      return;
    }

    console.error(`${pc.red("error")} ${serialized.error.message}`);
    if (serialized.error.nextCommand) {
      console.error(`next: ${serialized.error.nextCommand}`);
    }
    if (serialized.error.hint) {
      console.error(pc.dim(`hint: ${serialized.error.hint}`));
    }

    process.exitCode = 1;
  }
}

await main();

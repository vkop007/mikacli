#!/usr/bin/env node

import pc from "picocolors";

import { errorToJson } from "./errors.js";
import { assertCategoryOnlyInvocation, createProgram } from "./program.js";
import { printJson } from "./utils/output.js";

async function main(): Promise<void> {
  const program = createProgram();

  try {
    assertCategoryOnlyInvocation(process.argv.slice(2));
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

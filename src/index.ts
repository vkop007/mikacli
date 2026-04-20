#!/usr/bin/env node

import pc from "picocolors";

import { MikaCliError } from "./errors.js";
import { assertCategoryOnlyInvocation, createProgram } from "./program.js";
import { printJson } from "./utils/output.js";
import { serializeCliError } from "./utils/error-recovery.js";
import { appendActionLog, buildActionLogCommandLabel, inferSafeCommandPath, markActionLogCaptured, wasActionLogCaptured } from "./utils/action-log.js";
import { isBrowserNodeReexecRequired, reexecBrowserCommandInNode } from "./utils/node-browser-reexec.js";

async function main(): Promise<void> {
  const program = createProgram();
  const startedAt = new Date();

  try {
    assertCategoryOnlyInvocation(process.argv.slice(2));
    await program.parseAsync(process.argv);
  } catch (error) {
    try {
      if (
        process.versions.bun &&
        process.env.MIKACLI_NODE_BROWSER_REEXEC !== "1" &&
        isBrowserNodeReexecRequired(error)
      ) {
        process.exitCode = await reexecBrowserCommandInNode(import.meta.url, process.argv);
        return;
      }
    } catch (reexecError) {
      error = reexecError;
    }

    const serialized = serializeCliError(error);
    if (!wasActionLogCaptured(error)) {
      const finishedAt = new Date();
      const platform = readErrorDetail(error, "platform");
      const action = readErrorDetail(error, "action");
      const account = readErrorDetail(error, "account");
      const commandPath = inferSafeCommandPath(process.argv.slice(2));
      await appendActionLog({
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        status: "failed",
        command: buildActionLogCommandLabel({
          platform,
          action,
          commandPath,
        }),
        commandPath,
        ...(platform ? { platform } : {}),
        ...(account ? { account } : {}),
        ...(action ? { action } : {}),
        message: serialized.error.message,
        errorCode: serialized.error.code,
        ...(serialized.error.nextCommand ? { nextCommand: serialized.error.nextCommand } : {}),
        ...(serialized.error.hint ? { hint: serialized.error.hint } : {}),
      }).catch(() => undefined);
      markActionLogCaptured(error);
    }

    const wantsJson = process.argv.includes("--json");
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

function readErrorDetail(error: unknown, key: "platform" | "action" | "account"): string | undefined {
  if (!(error instanceof MikaCliError)) {
    return undefined;
  }

  const value = error.details?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

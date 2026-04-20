import { spawn } from "node:child_process";

import { MikaCliError } from "../../../errors.js";

export async function runEditorBinary(input: {
  command: string;
  args: readonly string[];
  missingCode: string;
  missingMessage: string;
  failureCode?: string;
  failureMessage?: string;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(input.command, input.args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      rejectPromise(
        new MikaCliError(input.missingCode, input.missingMessage, {
          details: {
            command: input.command,
          },
          cause: error,
        }),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new MikaCliError(
          input.failureCode ?? "EDITOR_COMMAND_FAILED",
          input.failureMessage ?? `${input.command} exited with code ${code}.`,
          {
            details: {
              command: input.command,
              args: input.args,
              stdout: stdout.trim() || null,
              stderr: stderr.trim() || null,
            },
          },
        ),
      );
    });
  });
}

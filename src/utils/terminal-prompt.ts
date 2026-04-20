import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { MikaCliError } from "../errors.js";

export async function promptForInput(label: string, options: { secret?: boolean } = {}): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    throw new MikaCliError(
      "INTERACTIVE_INPUT_REQUIRED",
      `Missing required input for ${label}. Run the command in a TTY or pass the required flag explicitly.`,
      {
        details: {
          label,
        },
      },
    );
  }

  const rl = createInterface({ input, output, terminal: true });
  try {
    if (!options.secret) {
      return (await rl.question(`${label}: `)).trim();
    }

    const originalWrite = output.write.bind(output);
    output.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding, callback?: (error?: Error | null) => void) => {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(encoding);
      if (text.startsWith(`${label}: `) || text === "\n" || text === "\r\n") {
        return originalWrite(chunk as never, encoding as never, callback as never);
      }

      const masked = typeof chunk === "string" ? "*".repeat(text.length) : Buffer.from("*".repeat(text.length));
      return originalWrite(masked as never, encoding as never, callback as never);
    }) as typeof output.write;

    try {
      return (await rl.question(`${label}: `)).trim();
    } finally {
      output.write = originalWrite;
      output.write("\n");
    }
  } finally {
    rl.close();
  }
}

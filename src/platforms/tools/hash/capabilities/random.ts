import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { hashAdapter, type HashAdapter } from "../adapter.js";
import { parsePositiveInteger } from "../helpers.js";
import { printHashResult } from "../output.js";

export function createHashRandomCapability(adapter: HashAdapter) {
  return createAdapterActionCapability({
    id: "random",
    command: "random",
    aliases: ["secret"],
    description: "Generate cryptographically random secrets",
    spinnerText: "Generating random values...",
    successMessage: "Random values generated.",
    options: [
      { flags: "--bytes <number>", description: "Entropy per value in bytes (default: 32)", parser: (value) => parsePositiveInteger(value, "bytes") },
      { flags: "--count <number>", description: "How many values to generate (default: 1)", parser: (value) => parsePositiveInteger(value, "count") },
      { flags: "--encoding <encoding>", description: "Output encoding: hex, base64, base64url (default: hex)" },
    ],
    action: ({ options }) =>
      adapter.random({
        bytes: options.bytes as number | undefined,
        count: options.count as number | undefined,
        encoding: options.encoding as never,
      }),
    onSuccess: printHashResult,
  });
}

export const hashRandomCapability = createHashRandomCapability(hashAdapter);

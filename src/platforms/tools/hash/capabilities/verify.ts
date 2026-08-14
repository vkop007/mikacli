import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { hashAdapter, type HashAdapter } from "../adapter.js";
import { joinTextArgument } from "../helpers.js";
import { printHashResult } from "../output.js";

export function createHashVerifyCapability(adapter: HashAdapter) {
  return createAdapterActionCapability({
    id: "verify",
    command: "verify <expected> [text...]",
    description: "Check text or a file against an expected checksum",
    spinnerText: "Verifying checksum...",
    successMessage: "Checksum checked.",
    options: [
      { flags: "--file <path>", description: "Verify a file instead of text" },
      { flags: "--alg <algorithm>", description: "Hash algorithm (inferred from the checksum length by default)" },
    ],
    action: ({ args, options }) =>
      adapter.verify({
        expected: String(args[0] ?? ""),
        text: joinTextArgument(args[1]),
        file: options.file as string | undefined,
        algorithm: options.alg as string | undefined,
      }),
    onSuccess: printHashResult,
  });
}

export const hashVerifyCapability = createHashVerifyCapability(hashAdapter);

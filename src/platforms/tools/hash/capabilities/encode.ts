import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { hashAdapter, type HashAdapter } from "../adapter.js";
import { printHashResult } from "../output.js";

export function createHashEncodeCapability(adapter: HashAdapter) {
  return createAdapterActionCapability({
    id: "encode",
    command: "encode <value>",
    description: "Convert a value between utf8, base64, base64url, hex, and url encodings",
    spinnerText: "Converting value...",
    successMessage: "Value converted.",
    options: [
      { flags: "--from <encoding>", description: "Input encoding (default: utf8)" },
      { flags: "--to <encoding>", description: "Output encoding (default: base64)" },
    ],
    action: ({ args, options }) =>
      adapter.encode({
        value: String(args[0] ?? ""),
        from: options.from as never,
        to: options.to as never,
      }),
    onSuccess: printHashResult,
  });
}

export const hashEncodeCapability = createHashEncodeCapability(hashAdapter);

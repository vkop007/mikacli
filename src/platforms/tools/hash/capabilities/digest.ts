import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { hashAdapter, type HashAdapter } from "../adapter.js";
import { joinTextArgument } from "../helpers.js";
import { printHashResult } from "../output.js";

export function createHashDigestCapability(adapter: HashAdapter) {
  return createAdapterActionCapability({
    id: "digest",
    command: "digest [text...]",
    aliases: ["hash", "sum"],
    description: "Hash text or a file with any supported algorithm",
    spinnerText: "Computing digest...",
    successMessage: "Digest computed.",
    options: [
      { flags: "--alg <algorithm>", description: "Hash algorithm (default: sha256)" },
      { flags: "--file <path>", description: "Hash a file instead of text" },
      { flags: "--encoding <encoding>", description: "Digest encoding: hex, base64, base64url (default: hex)" },
    ],
    action: ({ args, options }) =>
      adapter.digest({
        text: joinTextArgument(args[0]),
        file: options.file as string | undefined,
        algorithm: options.alg as string | undefined,
        encoding: options.encoding as never,
      }),
    onSuccess: printHashResult,
  });
}

export const hashDigestCapability = createHashDigestCapability(hashAdapter);

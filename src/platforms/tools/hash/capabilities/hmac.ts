import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { hashAdapter, type HashAdapter } from "../adapter.js";
import { joinTextArgument } from "../helpers.js";
import { printHashResult } from "../output.js";

export function createHashHmacCapability(adapter: HashAdapter) {
  return createAdapterActionCapability({
    id: "hmac",
    command: "hmac [text...]",
    description: "Compute an HMAC signature for text or a file",
    spinnerText: "Computing HMAC...",
    successMessage: "HMAC computed.",
    options: [
      { flags: "--secret <key>", description: "Shared secret used as the HMAC key" },
      { flags: "--key-file <path>", description: "Read the HMAC key from a file" },
      { flags: "--alg <algorithm>", description: "Hash algorithm (default: sha256)" },
      { flags: "--file <path>", description: "Sign a file instead of text" },
      { flags: "--encoding <encoding>", description: "Digest encoding: hex, base64, base64url (default: hex)" },
    ],
    action: ({ args, options }) =>
      adapter.hmac({
        text: joinTextArgument(args[0]),
        file: options.file as string | undefined,
        secret: options.secret as string | undefined,
        keyFile: options.keyFile as string | undefined,
        algorithm: options.alg as string | undefined,
        encoding: options.encoding as never,
      }),
    onSuccess: printHashResult,
  });
}

export const hashHmacCapability = createHashHmacCapability(hashAdapter);

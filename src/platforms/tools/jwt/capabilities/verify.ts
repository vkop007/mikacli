import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { jwtAdapter, type JwtAdapter } from "../adapter.js";
import { printJwtResult } from "../output.js";

export function createJwtVerifyCapability(adapter: JwtAdapter) {
  return createAdapterActionCapability({
    id: "verify",
    command: "verify <token>",
    description: "Verify a JSON Web Token signature offline",
    spinnerText: "Verifying token signature...",
    successMessage: "Token signature verified.",
    options: [
      { flags: "--secret <key>", description: "HMAC secret or RSA/ECDSA public key string" },
      { flags: "--key-file <path>", description: "Path to public key file" },
    ],
    action: ({ args, options }) =>
      adapter.verify({
        token: String(args[0] ?? ""),
        secret: options.secret as string | undefined,
        keyFile: options.keyFile as string | undefined,
      }),
    onSuccess: printJwtResult,
  });
}

export const jwtVerifyCapability = createJwtVerifyCapability(jwtAdapter);

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { jwtAdapter, type JwtAdapter } from "../adapter.js";
import { printJwtResult } from "../output.js";

export function createJwtSignCapability(adapter: JwtAdapter) {
  return createAdapterActionCapability({
    id: "sign",
    command: "sign",
    description: "Generate and sign a new JSON Web Token offline",
    spinnerText: "Signing token...",
    successMessage: "Token signed.",
    options: [
      { flags: "--payload <json>", description: "JSON payload string" },
      { flags: "--secret <key>", description: "HMAC secret or RSA private key string" },
      { flags: "--key-file <path>", description: "Path to private key file" },
      { flags: "--alg <algorithm>", description: "Signing algorithm (default: HS256)" },
      { flags: "--exp <duration>", description: "Expiration time duration (e.g. 1h, 1d, 30m)" },
    ],
    action: ({ options }) => {
      let payload: Record<string, unknown> = {};
      if (options.payload) {
        try {
          payload = JSON.parse(options.payload as string);
        } catch (err) {
          throw new Error(`Invalid JSON payload: ${(err as Error).message}`);
        }
      }
      return adapter.sign({
        payload,
        secretOrKey: options.secret as string | undefined,
        keyFile: options.keyFile as string | undefined,
        algorithm: options.alg as string | undefined,
        expiresIn: options.exp as string | undefined,
      });
    },
    onSuccess: printJwtResult,
  });
}

export const jwtSignCapability = createJwtSignCapability(jwtAdapter);

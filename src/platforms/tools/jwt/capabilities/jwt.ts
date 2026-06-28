import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { jwtAdapter, type JwtAdapter } from "../adapter.js";
import { printJwtResult } from "../output.js";

export function createJwtDecodeCapability(adapter: JwtAdapter) {
  return createAdapterActionCapability({
    id: "decode",
    command: "decode <token>",
    aliases: ["jwt"],
    description: "Decode and inspect JSON Web Tokens offline",
    spinnerText: "Decoding token...",
    successMessage: "Token decoded.",
    action: ({ args }) =>
      adapter.decode({
        token: String(args[0] ?? ""),
      }),
    onSuccess: printJwtResult,
  });
}

export const jwtDecodeCapability = createJwtDecodeCapability(jwtAdapter);

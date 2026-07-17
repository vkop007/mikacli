import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { jwtAdapter, type JwtAdapter } from "../adapter.js";
import { printJwtResult } from "../output.js";

export function createJwtAuditCapability(adapter: JwtAdapter) {
  return createAdapterActionCapability({
    id: "audit",
    command: "audit <token>",
    description: "Scan a JSON Web Token offline for potential security vulnerabilities",
    spinnerText: "Auditing token...",
    successMessage: "Token audited.",
    action: ({ args }) =>
      adapter.audit({
        token: String(args[0] ?? ""),
      }),
    onSuccess: printJwtResult,
  });
}

export const jwtAuditCapability = createJwtAuditCapability(jwtAdapter);

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearIdentityResult } from "../output.js";

export function createLinearLoginCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Save a Linear API key for future API calls",
    spinnerText: "Validating Linear token...",
    successMessage: "Linear token saved.",
    options: [{ flags: "--token <token>", description: "Linear personal API key", required: true }],
    action: ({ options }) =>
      adapter.loginWithToken({
        token: String(options.token ?? ""),
      }),
    onSuccess: printLinearIdentityResult,
  });
}

export const linearLoginCapability = createLinearLoginCapability(linearAdapter);


import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearIdentityResult } from "../output.js";

export function createLinearMeCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    aliases: ["whoami"],
    description: "Load the authenticated Linear web identity",
    spinnerText: "Loading Linear identity...",
    successMessage: "Linear identity loaded.",
    action: () => adapter.me(),
    onSuccess: printLinearIdentityResult,
  });
}

export const linearMeCapability = createLinearMeCapability(linearAdapter);

import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { hashAdapter, type HashAdapter } from "../adapter.js";
import { printHashResult } from "../output.js";

export function createHashAlgorithmsCapability(adapter: HashAdapter) {
  return createAdapterActionCapability({
    id: "algorithms",
    command: "algorithms",
    aliases: ["algs"],
    description: "List the hash algorithms available on this runtime",
    spinnerText: "Listing algorithms...",
    successMessage: "Algorithms listed.",
    action: () => adapter.algorithms(),
    onSuccess: printHashResult,
  });
}

export const hashAlgorithmsCapability = createHashAlgorithmsCapability(hashAdapter);

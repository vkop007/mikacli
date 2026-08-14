import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { hashAdapter, type HashAdapter } from "../adapter.js";
import { parsePositiveInteger } from "../helpers.js";
import { printHashResult } from "../output.js";

export function createHashUuidCapability(adapter: HashAdapter) {
  return createAdapterActionCapability({
    id: "uuid",
    command: "uuid",
    description: "Generate v4 or time-ordered v7 UUIDs",
    spinnerText: "Generating UUIDs...",
    successMessage: "UUIDs generated.",
    options: [
      { flags: "--count <number>", description: "How many UUIDs to generate (default: 1)", parser: (value) => parsePositiveInteger(value, "count") },
      { flags: "--uuid-version <number>", description: "UUID version: 4 or 7 (default: 4)", parser: (value) => parsePositiveInteger(value, "uuid-version") },
    ],
    action: ({ options }) =>
      adapter.uuid({
        count: options.count as number | undefined,
        version: options.uuidVersion as number | undefined,
      }),
    onSuccess: printHashResult,
  });
}

export const hashUuidCapability = createHashUuidCapability(hashAdapter);

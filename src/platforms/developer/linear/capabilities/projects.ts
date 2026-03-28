import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearProjectsResult } from "../output.js";
import { parsePositiveInteger } from "./limits.js";

export function createLinearProjectsCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "projects",
    command: "projects",
    description: "List Linear projects",
    spinnerText: "Loading Linear projects...",
    successMessage: "Linear projects loaded.",
    options: [{ flags: "--limit <number>", description: "Maximum projects to return (default: 20)", parser: parsePositiveInteger }],
    action: ({ options }) =>
      adapter.projects({
        limit: options.limit as number | undefined,
      }),
    onSuccess: printLinearProjectsResult,
  });
}

export const linearProjectsCapability = createLinearProjectsCapability(linearAdapter);


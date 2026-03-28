import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearTeamsResult } from "../output.js";
import { parsePositiveInteger } from "./limits.js";

export function createLinearTeamsCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "teams",
    command: "teams",
    description: "List Linear teams",
    spinnerText: "Loading Linear teams...",
    successMessage: "Linear teams loaded.",
    options: [{ flags: "--limit <number>", description: "Maximum teams to return (default: 20)", parser: parsePositiveInteger }],
    action: ({ options }) =>
      adapter.teams({
        limit: options.limit as number | undefined,
      }),
    onSuccess: printLinearTeamsResult,
  });
}

export const linearTeamsCapability = createLinearTeamsCapability(linearAdapter);


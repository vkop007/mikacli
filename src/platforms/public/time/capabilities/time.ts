import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { timeAdapter, type TimeAdapter } from "../adapter.js";
import { printTimeResult } from "../output.js";

export function createTimeLookupCapability(adapter: TimeAdapter) {
  return createAdapterActionCapability({
    id: "time",
    command: "time [timezone]",
    description: "Show local time using worldtimeapi.org by IP or timezone",
    spinnerText: "Loading time...",
    successMessage: "Time loaded.",
    action: ({ args }) =>
      adapter.time({
        timezone: args[0] ? String(args[0]) : undefined,
      }),
    onSuccess: printTimeResult,
  });
}

export const timeLookupCapability = createTimeLookupCapability(timeAdapter);

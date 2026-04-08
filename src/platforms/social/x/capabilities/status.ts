import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";

import { xAdapter } from "../adapter.js";
import { printXStatusResult } from "../output.js";

export const xStatusCapability = createAdapterActionCapability({
  id: "status",
  command: "status",
  description: "Show the saved X session status",
  spinnerText: "Checking X session...",
  successMessage: "X session checked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved X session" }],
  action: ({ options }) => xAdapter.statusAction(options.account as string | undefined),
  onSuccess: printXStatusResult,
});

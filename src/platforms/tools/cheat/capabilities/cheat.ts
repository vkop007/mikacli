import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { cheatAdapter } from "../adapter.js";
import { printCheatResult } from "../output.js";

export const cheatCapability = createAdapterActionCapability({
  id: "cheat",
  command: "cheat <topic...>",
  description: "Look up a concise cheat sheet snippet from cht.sh",
  spinnerText: "Loading cheat sheet...",
  successMessage: "Cheat sheet loaded.",
  options: [
    { flags: "--shell <bash|zsh|fish|powershell>", description: "Optional shell context for the lookup" },
    { flags: "--lang <lang>", description: "Optional language or context prefix" },
  ],
  action: ({ args, options }) =>
    cheatAdapter.cheat({
      topic: String(Array.isArray(args[0]) ? args[0].join(" ") : args[0] ?? ""),
      shell: options.shell as string | undefined,
      lang: options.lang as string | undefined,
    }),
  onSuccess: printCheatResult,
});


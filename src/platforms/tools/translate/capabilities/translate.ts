import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { translateAdapter, type TranslateAdapter } from "../adapter.js";
import { printTranslateResult } from "../output.js";

export function createTranslateCapability(adapter: TranslateAdapter) {
  return createAdapterActionCapability({
    id: "translate",
    command: "translate <text...>",
    description: "Translate text using Google Translate's public no-key endpoint",
    spinnerText: "Translating text...",
    successMessage: "Translation loaded.",
    options: [
      { flags: "--from <lang>", description: "Source language code or auto/detect" },
      { flags: "--to <lang>", description: "Target language code" },
    ],
    action: ({ args, options }) =>
      adapter.translate({
        text: args.map(String).join(" ").trim(),
        from: options.from as string | undefined,
        to: options.to as string | undefined,
      }),
    onSuccess: printTranslateResult,
  });
}

export const translateCapability = createTranslateCapability(translateAdapter);

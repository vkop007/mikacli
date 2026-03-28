import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { qrAdapter } from "../adapter.js";
import { printQrResult } from "../output.js";
import { parsePositiveInteger } from "../helpers.js";

function joinText(args: unknown[]): string {
  const first = args[0];
  if (Array.isArray(first)) {
    return first.map((part) => String(part)).join(" ").trim();
  }

  return String(first ?? "").trim();
}

export const qrCapability = createAdapterActionCapability({
  id: "qr",
  command: "qr <text...>",
  description: "Generate a QR code for text or a URL",
  spinnerText: "Generating QR code...",
  successMessage: "QR code generated.",
  options: [
    {
      flags: "--size <number>",
      description: "QR image size hint (default: 6)",
      parser: (value) => parsePositiveInteger(value, "size"),
    },
    {
      flags: "--margin <number>",
      description: "QR image margin in modules (default: 2)",
      parser: (value) => parsePositiveInteger(value, "margin"),
    },
    { flags: "--url", description: "Print a public image URL too" },
  ],
  action: ({ args, options }) =>
    qrAdapter.generate({
      text: joinText(args),
      size: options.size as number | undefined,
      margin: options.margin as number | undefined,
      includeUrl: Boolean(options.url),
    }),
  onSuccess: printQrResult,
});


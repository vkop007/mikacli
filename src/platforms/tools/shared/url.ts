import { MikaCliError } from "../../../errors.js";

export function normalizePublicHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new MikaCliError("PUBLIC_URL_REQUIRED", "A target URL is required.");
  }

  try {
    return validatePublicHttpUrl(new URL(trimmed));
  } catch {
    try {
      return validatePublicHttpUrl(new URL(`https://${trimmed}`));
    } catch {
      throw new MikaCliError("PUBLIC_URL_INVALID", `Invalid URL "${value}".`, {
        details: {
          value,
        },
      });
    }
  }
}

function validatePublicHttpUrl(url: URL): string {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }

  return url.toString();
}

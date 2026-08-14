import { MikaCliError } from "../../../errors.js";

export function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new MikaCliError("HASH_INVALID_NUMBER", `Invalid ${label}: expected a positive integer.`);
  }

  return parsed;
}

export function joinTextArgument(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.length === 0 ? undefined : value.map((entry) => String(entry)).join(" ");
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

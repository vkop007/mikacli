import { MikaCliError } from "../../../errors.js";

export function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MikaCliError("INVALID_NUMBER", `Expected a positive integer, received "${value}".`);
  }

  return parsed;
}

import { MikaCliError } from "../../../errors.js";

export function parseCareersLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MikaCliError("CAREERS_LIMIT_INVALID", "Expected --limit to be a positive integer.", {
      details: {
        value,
      },
    });
  }

  return parsed;
}

export function normalizeJobsLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.min(Math.max(limit, 1), max);
}

import { MikaCliError } from "../../../errors.js";

export function parseSocialLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MikaCliError("SOCIAL_LIMIT_INVALID", "Expected --limit to be a positive integer.", {
      details: {
        value,
      },
    });
  }

  return parsed;
}

export function normalizeSocialLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

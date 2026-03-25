export function parseLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected --limit to be a positive integer.");
  }

  return parsed;
}

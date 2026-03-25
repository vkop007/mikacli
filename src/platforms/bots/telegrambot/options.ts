export function parseTelegramLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected --limit to be a positive integer.");
  }

  return parsed;
}

export function parseTelegramMessageIdOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected the message id to be a positive integer.");
  }

  return parsed;
}

export function parseTelegramOffsetOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Expected the offset to be a non-negative integer.");
  }

  return parsed;
}

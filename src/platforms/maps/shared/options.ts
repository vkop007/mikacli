export function parseMapsLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }

  return parsed;
}

export function parseMapsZoomOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 18) {
    throw new Error(`Invalid zoom "${value}". Expected an integer between 0 and 18.`);
  }

  return parsed;
}

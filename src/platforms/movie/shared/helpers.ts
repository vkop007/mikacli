export function decodeHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCharCode(Number.parseInt(value, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, value: string) => String.fromCharCode(Number.parseInt(value, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

export function trimSummary(input: string, maxLength = 240): string {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

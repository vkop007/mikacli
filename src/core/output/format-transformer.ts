import { MikaCliError } from '../../errors.js';

export type OutputFormat = 'json' | 'csv' | 'table' | 'yaml' | 'markdown' | 'html';

interface FormatOptions {
  format: OutputFormat;
  headers?: boolean;
  colors?: boolean;
  maxWidth?: number;
  delimiter?: string;
}

/**
 * Transform output data into different formats
 */
export function formatOutput(
  data: unknown,
  options: FormatOptions
): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  // Extract items from wrapped response
  const items = extractItems(data);

  if (!Array.isArray(items) || items.length === 0) {
    return JSON.stringify(data, null, 2); // Fallback to JSON for non-list data
  }

  switch (options.format) {
    case 'csv':
      return formatAsCSV(items, options);
    case 'table':
      return formatAsTable(items, options);
    case 'yaml':
      return formatAsYAML(items, options);
    case 'markdown':
      return formatAsMarkdown(items, options);
    case 'html':
      return formatAsHTML(items, options);
    default:
      throw new MikaCliError('UNKNOWN_FORMAT', `Unknown format: ${options.format}`);
  }
}

/**
 * Extract items array from data structure
 */
function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    Array.isArray((data as Record<string, unknown>).items)
  ) {
    return (data as Record<string, unknown>).items as unknown[];
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'data' in data
  ) {
    const dataObj = (data as Record<string, unknown>).data;
    if (
      typeof dataObj === 'object' &&
      dataObj !== null &&
      'items' in dataObj &&
      Array.isArray((dataObj as Record<string, unknown>).items)
    ) {
      return (dataObj as Record<string, unknown>).items as unknown[];
    }
  }

  return [data];
}

/**
 * Format as CSV
 */
function formatAsCSV(
  items: unknown[],
  options: FormatOptions
): string {
  if (items.length === 0) {
    return '';
  }

  const delimiter = options.delimiter || ',';
  const firstItem = items[0] as Record<string, unknown>;
  const headers = Object.keys(flattenObject(firstItem));

  const rows: string[] = [];

  // Add header row
  if (options.headers !== false) {
    rows.push(escapeCSVField(headers, delimiter).join(delimiter));
  }

  // Add data rows
  for (const item of items) {
    const flat = flattenObject(item as Record<string, unknown>);
    const values = headers.map((h) => flat[h] ?? '');
    rows.push(escapeCSVField(values.map(String), delimiter).join(delimiter));
  }

  return rows.join('\n');
}

/**
 * Escape CSV fields with proper quoting
 */
function escapeCSVField(fields: string[], delimiter: string): string[] {
  return fields.map((field) => {
    if (
      field.includes(delimiter) ||
      field.includes('"') ||
      field.includes('\n')
    ) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  });
}

/**
 * Format as table
 */
function formatAsTable(
  items: unknown[],
  options: FormatOptions
): string {
  if (items.length === 0) {
    return '';
  }

  const firstItem = items[0] as Record<string, unknown>;
  const flat = flattenObject(firstItem);
  const headers = Object.keys(flat);

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const header of headers) {
    widths[header] = Math.min(header.length, options.maxWidth || 50);
  }

  for (const item of items) {
    const flat = flattenObject(item as Record<string, unknown>);
    for (const header of headers) {
      const value = String(flat[header] ?? '');
      widths[header] = Math.max(
        widths[header]!,
        Math.min(value.length, options.maxWidth || 50)
      );
    }
  }

  const lines: string[] = [];

  // Top border
  lines.push(buildTableBorder(headers, widths, 'top'));

  // Header row
  lines.push(buildTableRow(headers, widths, headers));

  // Header separator
  lines.push(buildTableBorder(headers, widths, 'mid'));

  // Data rows
  for (const item of items) {
    const flat = flattenObject(item as Record<string, unknown>);
    const values = headers.map((h) =>
      truncate(String(flat[h] ?? ''), widths[h]!)
    );
    lines.push(buildTableRow(headers, widths, values));
  }

  // Bottom border
  lines.push(buildTableBorder(headers, widths, 'bottom'));

  return lines.join('\n');
}

/**
 * Build table row with padding
 */
function buildTableRow(
  headers: string[],
  widths: Record<string, number>,
  values: string[]
): string {
  const cells = headers.map((h, i) => {
    const value = values[i] || '';
    return ` ${padRight(value, widths[h]!)} `;
  });
  return `│${cells.join('│')}│`;
}

/**
 * Build table border
 */
function buildTableBorder(
  headers: string[],
  widths: Record<string, number>,
  position: 'top' | 'mid' | 'bottom'
): string {
  const corners = {
    top: { left: '┌', mid: '┬', right: '┐' },
    mid: { left: '├', mid: '┼', right: '┤' },
    bottom: { left: '└', mid: '┴', right: '┘' },
  };

  const corner = corners[position];
  const cells = headers.map((h) => '─'.repeat(widths[h]! + 2));
  return `${corner.left}${cells.join(corner.mid)}${corner.right}`;
}

/**
 * Format as YAML
 */
function formatAsYAML(
  items: unknown[],
  _options: FormatOptions
): string {
  return items.map((item) => toYAML(item as Record<string, unknown>)).join('---\n');
}

/**
 * Convert object to YAML
 */
function toYAML(
  obj: Record<string, unknown>,
  indent = 0
): string {
  const lines: string[] = [];
  const indentStr = ' '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${indentStr}${key}: null`);
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        lines.push(`${indentStr}${key}:`);
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${indentStr}  - ${toYAML(item as Record<string, unknown>, indent + 4).trim()}`);
          } else {
            lines.push(`${indentStr}  - ${escapeYAMLValue(String(item))}`);
          }
        }
      } else {
        lines.push(`${indentStr}${key}:`);
        lines.push(toYAML(value as Record<string, unknown>, indent + 2));
      }
    } else {
      lines.push(`${indentStr}${key}: ${escapeYAMLValue(String(value))}`);
    }
  }

  return lines.join('\n');
}

/**
 * Escape YAML values
 */
function escapeYAMLValue(value: string): string {
  if (
    value.includes(':') ||
    value.includes('#') ||
    value.includes('"') ||
    value.startsWith(' ')
  ) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Format as Markdown table
 */
function formatAsMarkdown(
  items: unknown[],
  _options: FormatOptions
): string {
  if (items.length === 0) {
    return '';
  }

  const firstItem = items[0] as Record<string, unknown>;
  const headers = Object.keys(flattenObject(firstItem));

  const lines: string[] = [];

  // Header row
  lines.push(`| ${headers.join(' | ')} |`);

  // Separator
  lines.push(`|${headers.map(() => ' --- ').join('|')}|`);

  // Data rows
  for (const item of items) {
    const flat = flattenObject(item as Record<string, unknown>);
    const values = headers.map((h) => String(flat[h] ?? ''));
    lines.push(`| ${values.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Format as HTML table
 */
function formatAsHTML(
  items: unknown[],
  _options: FormatOptions
): string {
  if (items.length === 0) {
    return '';
  }

  const firstItem = items[0] as Record<string, unknown>;
  const headers = Object.keys(flattenObject(firstItem));

  const html: string[] = ['<table border="1" cellpadding="8" cellspacing="0">'];

  // Header row
  html.push('<thead><tr>');
  for (const header of headers) {
    html.push(`<th>${escapeHTML(header)}</th>`);
  }
  html.push('</tr></thead>');

  // Data rows
  html.push('<tbody>');
  for (const item of items) {
    const flat = flattenObject(item as Record<string, unknown>);
    html.push('<tr>');
    for (const header of headers) {
      const value = String(flat[header] ?? '');
      html.push(`<td>${escapeHTML(value)}</td>`);
    }
    html.push('</tr>');
  }
  html.push('</tbody>');

  html.push('</table>');

  return html.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]!);
}

/**
 * Flatten nested objects with dot notation
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[newKey] = value;
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = value.length > 0 ? JSON.stringify(value) : '[]';
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Pad string to right
 */
function padRight(str: string, width: number): string {
  return str.padEnd(width);
}

/**
 * Truncate string to width
 */
function truncate(str: string, width: number): string {
  return str.length > width ? str.substring(0, width - 1) + '…' : str;
}

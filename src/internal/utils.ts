/**
 * Shared internal helpers used across the parser, stringifier, exporters,
 * and CLI. This module is intentionally free of AST imports so it can be
 * reused without creating cycles.
 *
 * @internal
 */

/**
 * Exhaustiveness check for discriminated unions. Throws if an unexpected
 * value reaches a `default` branch.
 */
export function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${(value as { type?: string }).type ?? "unknown"}`);
}

/**
 * Zero-pad a number to two digits.
 */
export function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Format a `YYYY-MM-DD` date string from numeric components.
 */
export function formatDateParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Strip a single leading and trailing newline (`\n`, `\r`, or `\r\n`) from a
 * block's raw content so exporters can render the inner text cleanly.
 */
export function stripBlockBoundaryNewlines(content: string): string {
  let start = 0;
  let end = content.length;

  if (content.startsWith("\r\n")) {
    start = 2;
  } else if (content.startsWith("\n") || content.startsWith("\r")) {
    start = 1;
  }

  if (content.endsWith("\r\n")) {
    end -= 2;
  } else if (content.endsWith("\n") || content.endsWith("\r")) {
    end -= 1;
  }

  return content.slice(start, Math.max(start, end));
}

/**
 * Split block content into lines after removing boundary newlines.
 *
 * Individual lines keep their leading/trailing whitespace; callers that
 * need trimmed lines should trim the results themselves.
 */
export function splitBlockContentLines(content: string): ReadonlyArray<string> {
  const normalized = stripBlockBoundaryNewlines(content);
  if (normalized.length === 0) {
    return [];
  }

  return normalized.split(/\r?\n/);
}

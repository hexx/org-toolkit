import type { ASTNode } from "./ast.js";
import { parse } from "./parser.js";
import { stringify } from "./stringifier.js";

const TAG_COLUMN = 77;

/**
 * Format org text by parsing, normalizing annotations, and re-stringifying it.
 *
 * This function is pure and has no Node.js dependencies, so it is safe to use
 * from the browser/Worker main entry.
 *
 * @example
 * ```ts
 * const formatted = format("* TODO Task :work:");
 * ```
 */
export function format(text: string): string {
  const ast = structuredClone(parse(text)) as ASTNode;
  const normalized = stringify(ast);
  return alignHeadingTags(normalized);
}

function alignHeadingTags(text: string): string {
  return text
    .split("\n")
    .map((line) => alignHeadingTagsInLine(line))
    .join("\n");
}

function alignHeadingTagsInLine(line: string): string {
  const match = line.match(/^(?<body>\*+.*?)(?<space>\s)(?<tags>:[A-Za-z0-9_@#%]+(?::[A-Za-z0-9_@#%]+)*:)$/);
  if (match === null || match.groups === undefined) {
    return line;
  }

  const body = match.groups.body ?? "";
  const tags = match.groups.tags ?? "";
  const padding = Math.max(1, TAG_COLUMN - body.length);
  return `${body}${" ".repeat(padding)}${tags}`;
}

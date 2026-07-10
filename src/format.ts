import type { ASTNode } from "./ast.js";
import { parse } from "./parser.js";
import { stringify } from "./stringifier.js";

/**
 * Emacs `org-tags-column` default: tags are right-aligned so the tag group
 * starts at this 1-based column.
 */
const TAG_COLUMN = 77;

/**
 * Format org text by parsing, normalizing annotations, and re-stringifying it.
 *
 * Tag groups are aligned to {@link TAG_COLUMN} (matching Emacs'
 * `org-tags-column`). The AST is cloned before stringification so
 * parser-recorded spacing metadata is dropped and blank lines normalize to a
 * single separator between blocks.
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
  return stringify(ast, { alignTags: TAG_COLUMN });
}

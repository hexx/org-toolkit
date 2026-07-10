import type { ASTNode, InlineNode, TimestampNode } from "./ast.js";
import { assertNever, formatDateParts } from "./internal/utils.js";

/**
 * Extract readable plain text from any AST node.
 *
 * Inline formatting is stripped, links prefer their description text, and
 * block-level containers are flattened with line breaks so the result stays
 * easy to consume in search, indexing, and mind map integrations.
 *
 * @example
 * ```ts
 * const text = getTextContent(parse("* TODO Ship docs :work:"));
 * ```
 */
export function getTextContent(node: ASTNode): string {
  switch (node.type) {
    case "root":
      return joinText(node.children, "\n");
    case "document-metadata":
      return node.value;
    case "heading":
    case "paragraph":
    case "list-item":
    case "table-cell":
    case "footnote-definition":
      return joinText(node.children);
    case "list":
    case "table":
      return joinText(node.children, "\n");
    case "table-row":
      return node.rowType === "separator" ? "" : joinText(node.children, "\t");
    case "block":
      return node.content;
    case "comment":
      return node.content;
    case "text":
      return node.value;
    case "bold":
    case "italic":
    case "underline":
    case "strike-through":
      return joinText(node.children);
    case "code":
    case "verbatim":
      return node.value;
    case "link":
      return node.description === undefined ? node.url : joinText(node.description);
    case "footnote-reference":
      return node.label;
    case "timestamp":
      return formatTimestamp(node);
    default:
      return assertNever(node);
  }
}

function joinText(nodes: ReadonlyArray<ASTNode | InlineNode>, separator = ""): string {
  return nodes
    .map((child) => getTextContent(child))
    .filter((value) => value.length > 0)
    .join(separator);
}

function formatTimestamp(node: TimestampNode): string {
  const parts = [formatDateParts(node.year, node.month, node.day)];

  if (node.time !== undefined) {
    parts.push(node.time);
  }

  if (node.repeater !== undefined) {
    parts.push(node.repeater);
  }

  return parts.join(" ");
}


import type {
  ASTNode,
  DocumentMetadata,
  Heading,
  List,
  ListItem,
  ListKind,
  Paragraph,
  Root,
  Table,
  TableCell,
  TableRow,
  Text,
} from "../ast.js";

interface RenderContext {
  readonly listKind?: ListKind;
}

/**
 * Convert an AST node into GitHub Flavored Markdown.
 *
 * @example
 * ```ts
 * const markdown = toMarkdown(parse("* TODO Heading"));
 * ```
 */
export function toMarkdown(node: ASTNode): string {
  return render(node, {}).trimEnd();
}

function render(node: ASTNode, context: RenderContext): string {
  switch (node.type) {
    case "root":
      return renderRoot(node);
    case "document-metadata":
      return renderDocumentMetadata(node);
    case "heading":
      return renderHeading(node);
    case "paragraph":
      return renderParagraph(node, context);
    case "list":
      return renderList(node);
    case "list-item":
      return renderListItem(node, context);
    case "table":
      return renderTable(node);
    case "table-row":
      return renderTableRow(node);
    case "table-cell":
      return renderTableCell(node);
    case "text":
      return renderText(node);
    default:
      return assertNever(node);
  }
}

function renderRoot(node: Root): string {
  const parts = [
    ...node.metadata.map((metadata) => renderDocumentMetadata(metadata)),
    ...node.children.map((child) => render(child, {})),
  ].filter((part) => part.length > 0);

  return parts.join("\n\n");
}

function renderDocumentMetadata(node: DocumentMetadata): string {
  return `<!-- #+${node.key}: ${node.value} -->`;
}

function renderHeading(node: Heading): string {
  const prefix = `${"#".repeat(node.level)} ${node.todoKeyword ? `${node.todoKeyword} ` : ""}${node.title}`.trimEnd();
  if (node.tags.length === 0) {
    return prefix;
  }

  return `${prefix} <!-- :${node.tags.join(":")}: -->`;
}

function renderParagraph(node: Paragraph, context: RenderContext): string {
  return node.children.map((child) => render(child, context)).join("");
}

function renderList(node: List): string {
  return node.children.map((item) => renderListItem(item, { listKind: node.kind })).join("\n");
}

function renderListItem(node: ListItem, context: RenderContext): string {
  const marker =
    context.listKind === "ordered"
      ? "1."
      : context.listKind === "unordered"
        ? "-"
        : node.marker;
  const checkbox =
    node.checkbox === null ? "" : ` ${node.checkbox === "checked" ? "[x]" : "[ ]"}`;
  const content = renderListItemChildren(node.children, context).trim();

  if (content.length === 0) {
    return `${marker}${checkbox}`.trimEnd();
  }

  return `${marker}${checkbox} ${content}`;
}

function renderListItemChildren(
  children: ReadonlyArray<Paragraph | List | Text>,
  context: RenderContext,
): string {
  return children.map((child) => render(child, context)).join("\n");
}

function renderTable(node: Table): string {
  const columnCount = node.children.reduce((max, row) => {
    if (row.rowType !== "data") {
      return max;
    }

    return Math.max(max, row.children.length);
  }, 0);

  return node.children.map((row) => renderTableRow(row, columnCount)).join("\n");
}

function renderTableRow(node: TableRow, columnCount?: number): string {
  if (node.rowType === "separator") {
    const effectiveColumnCount =
      columnCount ?? Math.max(node.children.length, 1);
    return `|${Array.from({ length: effectiveColumnCount }, () => "---").join("|")}|`;
  }

  const cells = node.children.map((cell) => renderTableCell(cell));
  return `| ${cells.join(" | ")} |`;
}

function renderTableCell(node: TableCell): string {
  return node.value.trim();
}

function renderText(node: Text): string {
  return node.value;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${(value as { type?: string }).type ?? "unknown"}`);
}

import type {
  ASTNode,
  DocumentMetadata,
  InlineNode,
  Heading,
  List,
  ListItem,
  Paragraph,
  Root,
  Table,
  TableCell,
  TableRow,
  TextNode,
} from "./ast.js";

/**
 * Convert an AST node back into normalized org-mode text.
 *
 * The stringifier walks the tree recursively and emits a stable text form so
 * parse/stringify round trips remain easy to verify.
 *
 * @example
 * ```ts
 * const text = stringify(parse("* TODO Heading"));
 * ```
 */
export function stringify(node: ASTNode): string {
  switch (node.type) {
    case "root":
      return stringifyRoot(node);
    case "document-metadata":
      return stringifyDocumentMetadata(node);
    case "heading":
      return stringifyHeading(node);
    case "paragraph":
      return stringifyParagraph(node);
    case "list":
      return stringifyList(node);
    case "list-item":
      return stringifyListItem(node);
    case "table":
      return stringifyTable(node);
    case "table-row":
      return stringifyTableRow(node);
    case "table-cell":
      return stringifyTableCell(node);
    case "text":
      return stringifyText(node);
    case "bold":
    case "italic":
    case "underline":
    case "strike-through":
    case "code":
    case "verbatim":
      return stringifyInlineNode(node);
    default:
      return assertNever(node);
  }
}

function stringifyRoot(node: Root): string {
  const metadata = node.metadata.map(stringifyDocumentMetadata);
  const children = node.children.map(stringify).filter((value) => value.length > 0);

  if (metadata.length === 0) {
    return children.join("\n\n");
  }

  if (children.length === 0) {
    return metadata.join("\n");
  }

  return `${metadata.join("\n")}\n\n${children.join("\n\n")}`;
}

function stringifyDocumentMetadata(node: DocumentMetadata): string {
  return `#+${node.key}: ${node.value}`.trimEnd();
}

function stringifyHeading(node: Heading): string {
  const parts: string[] = ["*".repeat(node.level)];

  if (node.todoKeyword !== undefined) {
    parts.push(node.todoKeyword);
  }

  const content = stringifyInline(node.children);
  if (content.length > 0) {
    parts.push(content);
  }

  let line = parts.join(" ");
  if (node.tags.length > 0) {
    line += ` :${node.tags.join(":")}:`;
  }

  return line;
}

function stringifyParagraph(node: Paragraph): string {
  return stringifyInline(node.children);
}

function stringifyList(node: List): string {
  return node.children.map(stringifyListItem).join("\n");
}

function stringifyListItem(node: ListItem): string {
  const prefix = node.checkbox === null ? node.marker : `${node.marker} ${formatCheckbox(node.checkbox)}`;
  const content = stringifyInline(node.children);
  return content.length > 0 ? `${prefix} ${content}` : prefix;
}

function stringifyTable(node: Table): string {
  const widths = calculateTableWidths(node.children);
  return node.children.map((row) => stringifyTableRow(row, widths)).join("\n");
}

function stringifyTableRow(node: TableRow, widths?: ReadonlyArray<number>): string {
  if (node.rowType === "separator") {
    const separatorWidths =
      widths !== undefined && widths.length > 0
        ? widths
        : node.children.length > 0
          ? node.children.map((cell) => Math.max(3, stringifyTableCell(cell).length))
          : [3];
    return `|${separatorWidths.map((width) => "-".repeat(Math.max(3, width))).join("+")}|`;
  }

  const rowWidths =
    widths !== undefined && widths.length > 0
      ? widths
      : node.children.map((cell) => Math.max(3, stringifyTableCell(cell).length));

  const cells = node.children.map((cell, index) => {
    const value = stringifyTableCell(cell);
    const width = rowWidths[index] ?? Math.max(3, value.length);
    return ` ${value.padEnd(width)} `;
  });

  return `|${cells.join("|")}|`;
}

function stringifyTableCell(node: TableCell): string {
  return stringifyInline(node.children);
}

function stringifyText(node: TextNode): string {
  return node.value;
}

function calculateTableWidths(rows: ReadonlyArray<TableRow>): ReadonlyArray<number> {
  const widths: number[] = [];

  for (const row of rows) {
    if (row.rowType !== "data") {
      continue;
    }

    row.children.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, stringifyTableCell(cell).length);
    });
  }

  return widths;
}

function stringifyInline(nodes: ReadonlyArray<InlineNode>): string {
  return nodes.map((node) => stringify(node)).join("");
}

function stringifyInlineNode(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "bold":
      return `*${stringifyInline(node.children)}*`;
    case "italic":
      return `/${stringifyInline(node.children)}/`;
    case "underline":
      return `_${stringifyInline(node.children)}_`;
    case "strike-through":
      return `+${stringifyInline(node.children)}+`;
    case "code":
      return `=${node.value}=`;
    case "verbatim":
      return `~${node.value}~`;
    default:
      return assertNever(node);
  }
}

function formatCheckbox(checkbox: NonNullable<ListItem["checkbox"]>): string {
  return checkbox === "checked" ? "[X]" : "[ ]";
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${(value as { type?: string }).type ?? "unknown"}`);
}

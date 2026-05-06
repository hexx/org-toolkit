import type {
  ASTNode,
  Block,
  DocumentMetadata,
  InlineNode,
  Heading,
  List,
  ListItem,
  LinkNode,
  Paragraph,
  Root,
  Table,
  TableCell,
  TableRow,
  TextNode,
  TimestampNode,
} from "./ast.js";
import {
  readBlankLinesAfter,
  readHeadingPlanningLines,
  readTimestampText,
} from "./node-annotations.js";

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
    case "block":
      return stringifyBlock(node);
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
    case "link":
      return stringifyLink(node);
    case "timestamp":
      return stringifyTimestamp(node);
    default:
      return assertNever(node);
  }
}

function stringifyRoot(node: Root): string {
  const metadata = Object.entries(node.metadata).map(([key, value]) => `#+${key}: ${value}`.trimEnd());
  const children = joinTopLevelChildren(node.children, stringify);

  if (metadata.length === 0) {
    return children;
  }

  if (children.length === 0) {
    return metadata.join("\n");
  }

  return `${metadata.join("\n")}\n\n${children}`;
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

  const sections = [line];
  const planning = stringifyHeadingPlanning(node);
  if (planning.length > 0) {
    sections.push(...planning);
  }

  if (Object.keys(node.properties).length > 0) {
    sections.push(stringifyPropertyDrawer(node.properties));
  }

  return sections.join("\n");
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

function stringifyBlock(node: Block): string {
  const begin = `#+BEGIN_${node.blockName}${node.parameters.length > 0 ? ` ${node.parameters}` : ""}`;
  const end = `#+END_${node.blockName}`;
  return `${begin}${node.content}${end}`;
}

function stringifyPropertyDrawer(properties: Readonly<Record<string, string>>): string {
  const lines = Object.entries(properties).map(([key, value]) => `:${key}: ${value}`.trimEnd());
  return [":PROPERTIES:", ...lines, ":END:"].join("\n");
}

function stringifyHeadingPlanning(node: Heading): ReadonlyArray<string> {
  const rawLines = readHeadingPlanningLines(node);
  if (rawLines !== undefined) {
    return rawLines;
  }

  if (node.planning === undefined) {
    return [];
  }

  const lines: string[] = [];
  if (node.planning.scheduled !== undefined) {
    lines.push(`SCHEDULED: ${stringifyTimestamp(node.planning.scheduled)}`);
  }
  if (node.planning.deadline !== undefined) {
    lines.push(`DEADLINE: ${stringifyTimestamp(node.planning.deadline)}`);
  }
  if (node.planning.closed !== undefined) {
    lines.push(`CLOSED: ${stringifyTimestamp(node.planning.closed)}`);
  }

  return lines;
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

function stringifyTimestamp(node: TimestampNode): string {
  const rawText = readTimestampText(node);
  if (rawText !== undefined) {
    return rawText;
  }

  const open = node.isActive ? "<" : "[";
  const close = node.isActive ? ">" : "]";
  const parts = [`${node.year.toString().padStart(4, "0")}-${node.month.toString().padStart(2, "0")}-${node.day.toString().padStart(2, "0")}`];

  if (node.time !== undefined) {
    parts.push(node.time);
  }

  if (node.repeater !== undefined) {
    parts.push(node.repeater);
  }

  return `${open}${parts.join(" ")}${close}`;
}

function joinTopLevelChildren<T extends { readonly type: string }>(
  children: ReadonlyArray<T>,
  renderNode: (node: T) => string,
): string {
  const rendered: string[] = [];

  children.forEach((child, index) => {
    const value = renderNode(child);
    if (value.length === 0) {
      return;
    }

    if (rendered.length > 0) {
      const previous = children[index - 1];
      const blankLinesAfter = previous === undefined ? undefined : readBlankLinesAfter(previous);
      const blankLines = blankLinesAfter ?? 1;
      rendered.push("\n".repeat(blankLines + 1));
    }

    rendered.push(value);
  });

  return rendered.join("");
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
    case "link":
      return stringifyLink(node);
    case "timestamp":
      return stringifyTimestamp(node);
    default:
      return assertNever(node);
  }
}

function stringifyLink(node: LinkNode): string {
  if (node.description === undefined) {
    return `[[${node.url}]]`;
  }

  return `[[${node.url}][${stringifyInline(node.description)}]]`;
}

function formatCheckbox(checkbox: NonNullable<ListItem["checkbox"]>): string {
  return checkbox === "checked" ? "[X]" : "[ ]";
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${(value as { type?: string }).type ?? "unknown"}`);
}

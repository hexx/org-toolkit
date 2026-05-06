import type {
  ASTNode,
  Block,
  CommentNode,
  DocumentMetadata,
  FootnoteDefinitionNode,
  FootnoteReferenceNode,
  InlineNode,
  Heading,
  List,
  ListItem,
  ListKind,
  LinkNode,
  Paragraph,
  Root,
  Table,
  TableCell,
  TableRow,
  TextNode,
  TimestampNode,
} from "../ast.js";
import {
  readBlankLinesAfter,
  readTimestampText,
} from "../node-annotations.js";

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
    case "block":
      return renderBlock(node);
    case "comment":
      return renderComment(node);
    case "table":
      return renderTable(node);
    case "table-row":
      return renderTableRow(node);
    case "table-cell":
      return renderTableCell(node);
    case "text":
      return renderText(node);
    case "bold":
    case "italic":
    case "underline":
    case "strike-through":
    case "code":
    case "verbatim":
      return renderInlineNode(node);
    case "link":
      return renderLink(node);
    case "footnote-reference":
      return renderFootnoteReference(node);
    case "footnote-definition":
      return renderFootnoteDefinition(node);
    case "timestamp":
      return renderTimestamp(node);
    default:
      return assertNever(node);
  }
}

function renderRoot(node: Root): string {
  const frontmatter = renderFrontmatter(node.metadata);
  const children = joinTopLevelChildren(node.children, (child) => render(child, {}));

  if (frontmatter.length === 0) {
    return children;
  }

  if (children.length === 0) {
    return frontmatter;
  }

  return `${frontmatter}\n\n${children}`;
}

function renderDocumentMetadata(node: DocumentMetadata): string {
  return `<!-- #+${node.key}: ${node.value} -->`;
}

function renderComment(node: CommentNode): string {
  void node;
  return "";
}

function renderFrontmatter(metadata: Readonly<Record<string, string>>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return "";
  }

  const lines = entries.map(([key, value]) => `${key.toLowerCase()}: ${value}`);
  return [`---`, ...lines, `---`].join("\n");
}

function renderHeading(node: Heading): string {
  const content = renderInline(node.children);
  const prefix = `${"#".repeat(node.level)} ${node.todoKeyword ? `${node.todoKeyword} ` : ""}${content}`.trimEnd();
  const sections = [node.tags.length === 0 ? prefix : `${prefix} <!-- :${node.tags.join(":")}: -->`];
  const planning = renderHeadingPlanning(node);
  if (planning.length > 0) {
    sections.push(...planning);
  }

  const properties = renderHeadingProperties(node.properties);
  if (properties.length > 0) {
    sections.push(properties);
  }

  return sections.join("\n");
}

function renderParagraph(node: Paragraph, context: RenderContext): string {
  void context;
  return renderInline(node.children);
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
  const content = renderInline(node.children).trim();

  if (content.length === 0) {
    return `${marker}${checkbox}`.trimEnd();
  }

  return `${marker}${checkbox} ${content}`;
}

function renderBlock(node: Block): string {
  if (node.blockName === "SRC") {
    const language = node.parameters.trim();
    const fence = language.length > 0 ? `\`\`\`${language}` : "```";
    const content = stripBlockBoundaryNewlines(node.content);
    return content.length > 0 ? `${fence}\n${content}\n\`\`\`` : `${fence}\n\`\`\``;
  }

  if (node.blockName === "QUOTE") {
    const lines = splitBlockContentLines(node.content).map((line) =>
      line.length > 0 ? `> ${line}` : ">",
    );
    return lines.length > 0 ? lines.join("\n") : ">";
  }

  const header = `<!-- #+BEGIN_${node.blockName}${node.parameters.length > 0 ? ` ${node.parameters}` : ""} -->`;
  const footer = `<!-- #+END_${node.blockName} -->`;
  const content = stripBlockBoundaryNewlines(node.content);
  return content.length > 0 ? `${header}\n${content}\n${footer}` : `${header}\n${footer}`;
}

function renderHeadingProperties(properties: Readonly<Record<string, string>>): string {
  if (Object.keys(properties).length === 0) {
    return "";
  }

  const lines = Object.entries(properties).map(([key, value]) => `:${key}: ${value}`.trimEnd());
  return `<!--\n${[":PROPERTIES:", ...lines, ":END:"].join("\n")}\n-->`;
}

function renderFootnoteReference(node: FootnoteReferenceNode): string {
  return `[^${node.label}]`;
}

function renderFootnoteDefinition(node: FootnoteDefinitionNode): string {
  const content = renderInline(node.children);
  return content.length > 0 ? `[^${node.label}]: ${content}` : `[^${node.label}]:`;
}

function renderHeadingPlanning(node: Heading): ReadonlyArray<string> {
  if (node.planning === undefined) {
    return [];
  }

  const lines: string[] = [];
  if (node.planning.scheduled !== undefined) {
    lines.push(`**SCHEDULED:** ${renderTimestamp(node.planning.scheduled)}`);
  }
  if (node.planning.deadline !== undefined) {
    lines.push(`**DEADLINE:** ${renderTimestamp(node.planning.deadline)}`);
  }
  if (node.planning.closed !== undefined) {
    lines.push(`**CLOSED:** ${renderTimestamp(node.planning.closed)}`);
  }

  return lines;
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
  return renderInline(node.children).trim();
}

function renderText(node: TextNode): string {
  return node.value;
}

function renderTimestamp(node: TimestampNode): string {
  const rawText = readTimestampText(node);
  if (rawText !== undefined) {
    const inner = rawText.slice(1, -1);
    const parts = inner.split(/\s+/);
    if (parts.length >= 1) {
      const date = parts[0] ?? "";
      const time = parts.find((part) => /^\d{2}:\d{2}$/.test(part));
      return time === undefined ? date : `${date} ${time}`;
    }
  }

  const date = `${node.year.toString().padStart(4, "0")}-${node.month.toString().padStart(2, "0")}-${node.day.toString().padStart(2, "0")}`;
  return node.time === undefined ? date : `${date} ${node.time}`;
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

function renderInline(nodes: ReadonlyArray<InlineNode>): string {
  return nodes.map((node) => render(node, {})).join("");
}

function renderInlineNode(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "bold":
      return `**${renderInline(node.children)}**`;
    case "italic":
      return `*${renderInline(node.children)}*`;
    case "underline":
      return `<u>${renderInline(node.children)}</u>`;
    case "strike-through":
      return `~~${renderInline(node.children)}~~`;
    case "code":
    case "verbatim":
      return renderCodeSpan(node.value);
    case "link":
      return renderLink(node);
    case "footnote-reference":
      return renderFootnoteReference(node);
    case "timestamp":
      return renderTimestamp(node);
    default:
      return assertNever(node);
  }
}

function renderLink(node: LinkNode): string {
  if (node.description === undefined) {
    return `[${node.url}](${node.url})`;
  }

  return `[${renderInline(node.description)}](${node.url})`;
}

function renderCodeSpan(value: string): string {
  const runs = value.match(/`+/g);
  const fenceLength = (runs?.reduce((max, run) => Math.max(max, run.length), 0) ?? 0) + 1;
  const fence = "`".repeat(fenceLength);
  const needsPadding =
    value.startsWith(" ") || value.endsWith(" ") || value.startsWith("`") || value.endsWith("`");
  const content = needsPadding ? ` ${value} ` : value;
  return `${fence}${content}${fence}`;
}

function stripBlockBoundaryNewlines(content: string): string {
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

function splitBlockContentLines(content: string): ReadonlyArray<string> {
  const normalized = stripBlockBoundaryNewlines(content);
  if (normalized.length === 0) {
    return [];
  }

  return normalized.split(/\r?\n/);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${(value as { type?: string }).type ?? "unknown"}`);
}

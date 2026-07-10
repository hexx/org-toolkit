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
  LinkNode,
  Paragraph,
  Root,
  Table,
  TableCell,
  TableRow,
  TextNode,
  TimestampNode,
} from "./ast.js";
import { readHeadingPlanningLines } from "./node-annotations.js";
import { assertNever, formatDateParts } from "./internal/utils.js";
import { joinTopLevelChildren } from "./internal/render.js";

/** Options that adjust how the stringifier renders an AST. */
export interface StringifyOptions {
  /** When set, align heading tag groups to this 1-based column. */
  readonly alignTags?: number;
  /**
   * When `true` (the default), escape emphasis delimiter characters and
   * backslashes inside emphasis/code/verbatim content so that builder-built
   * ASTs round-trip safely through `stringify` -> `parse`. Set to `false` to
   * emit content verbatim.
   */
  readonly escapeDelimiters?: boolean;
}

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
export function stringify(node: ASTNode, options: StringifyOptions = {}): string {
  const ctx: InlineRenderContext = {
    escapeDelimiters: options.escapeDelimiters !== false,
    escapeChars: EMPTY_ESCAPE_CHARS,
  };

  switch (node.type) {
    case "root":
      return stringifyRoot(node, options);
    case "document-metadata":
      return stringifyDocumentMetadata(node);
    case "heading":
      return stringifyHeading(node, options.alignTags, ctx);
    case "paragraph":
      return stringifyParagraph(node, ctx);
    case "list":
      return stringifyList(node, ctx);
    case "list-item":
      return stringifyListItem(node, ctx);
    case "block":
      return stringifyBlock(node);
    case "comment":
      return stringifyComment(node);
    case "horizontal-rule":
      return stringifyHorizontalRule();
    case "table":
      return stringifyTable(node, ctx);
    case "table-row":
      return stringifyTableRow(node);
    case "table-cell":
      return stringifyTableCell(node, ctx);
    case "text":
      return stringifyText(node);
    case "hard-break":
      return stringifyHardBreak();
    case "bold":
    case "italic":
    case "underline":
    case "strike-through":
    case "code":
    case "verbatim":
      return stringifyInlineNode(node, ctx);
    case "link":
      return stringifyLink(node, ctx);
    case "footnote-reference":
      return stringifyFootnoteReference(node);
    case "footnote-definition":
      return stringifyFootnoteDefinition(node, ctx);
    case "timestamp":
      return stringifyTimestamp(node);
    default:
      return assertNever(node);
  }
}

function stringifyRoot(node: Root, options: StringifyOptions): string {
  const metadata = Object.entries(node.metadata).map(([key, value]) => `#+${key}: ${value}`.trimEnd());
  const children = joinTopLevelChildren(node.children, (child) => stringify(child, options));

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

function stringifyHeading(node: Heading, alignTags: number | undefined, ctx: InlineRenderContext): string {
  const parts: string[] = ["*".repeat(node.level)];

  if (node.todoKeyword !== undefined) {
    parts.push(node.todoKeyword);
  }

  const content = stringifyInline(node.children, ctx);
  if (content.length > 0) {
    parts.push(content);
  }

  let line = parts.join(" ");
  if (node.tags.length > 0) {
    const tags = `:${node.tags.join(":")}:`;
    if (alignTags !== undefined) {
      // Mimic Emacs `org-tags-column`: pad so the tag group starts at the
      // configured column, with at least one separating space.
      const padding = Math.max(1, alignTags - line.length);
      line += " ".repeat(padding) + tags;
    } else {
      line += ` ${tags}`;
    }
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

function stringifyParagraph(node: Paragraph, ctx: InlineRenderContext): string {
  return stringifyInline(node.children, ctx);
}

function stringifyList(node: List, ctx: InlineRenderContext): string {
  return node.children.map((item) => stringifyListItem(item, ctx)).join("\n");
}

function stringifyListItem(node: ListItem, ctx: InlineRenderContext): string {
  const prefix = node.checkbox === null ? node.marker : `${node.marker} ${formatCheckbox(node.checkbox)}`;
  const content = stringifyInline(node.children, ctx);
  let line = content.length > 0 ? `${prefix} ${content}` : prefix;

  if (node.subList !== undefined) {
    const sub = stringifyList(node.subList, ctx);
    line = `${line}\n${indentLines(sub, LIST_INDENT)}`;
  }

  return line;
}

function stringifyBlock(node: Block): string {
  const begin = `#+BEGIN_${node.blockName}${node.parameters.length > 0 ? ` ${node.parameters}` : ""}`;
  const end = `#+END_${node.blockName}`;
  return `${begin}${node.content}${end}`;
}

function stringifyComment(node: CommentNode): string {
  return `# ${node.content}`;
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

function stringifyTable(node: Table, ctx: InlineRenderContext): string {
  const widths = calculateTableWidths(node.children, ctx);
  return node.children.map((row) => stringifyTableRow(row, widths, ctx)).join("\n");
}

function stringifyTableRow(node: TableRow, widths?: ReadonlyArray<number>, ctx?: InlineRenderContext): string {
  if (node.rowType === "separator") {
    const separatorWidths =
      widths !== undefined && widths.length > 0
        ? widths
        : node.children.length > 0
          ? node.children.map((cell) => Math.max(3, stringifyTableCell(cell, ctx ?? NO_CONTEXT).length))
          : [3];
    return `|${separatorWidths.map((width) => "-".repeat(Math.max(3, width))).join("+")}|`;
  }

  const rowWidths =
    widths !== undefined && widths.length > 0
      ? widths
      : node.children.map((cell) => Math.max(3, stringifyTableCell(cell, ctx ?? NO_CONTEXT).length));

  const cells = node.children.map((cell, index) => {
    const value = stringifyTableCell(cell, ctx ?? NO_CONTEXT);
    const width = rowWidths[index] ?? Math.max(3, value.length);
    return ` ${value.padEnd(width)} `;
  });

  return `|${cells.join("|")}|`;
}

function stringifyTableCell(node: TableCell, ctx: InlineRenderContext): string {
  return stringifyInline(node.children, ctx);
}

function stringifyText(node: TextNode): string {
  return node.value;
}

function calculateTableWidths(rows: ReadonlyArray<TableRow>, ctx: InlineRenderContext): ReadonlyArray<number> {
  const widths: number[] = [];

  for (const row of rows) {
    if (row.rowType !== "data") {
      continue;
    }

    row.children.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, stringifyTableCell(cell, ctx).length);
    });
  }

  return widths;
}

function stringifyInline(nodes: ReadonlyArray<InlineNode>, ctx: InlineRenderContext): string {
  return nodes.map((node) => stringifyInlineNode(node, ctx)).join("");
}

function stringifyTimestamp(node: TimestampNode): string {
  const open = node.isActive ? "<" : "[";
  const close = node.isActive ? ">" : "]";
  const parts = [formatDateParts(node.year, node.month, node.day)];

  if (node.weekday !== undefined) {
    parts.push(node.weekday);
  }

  if (node.time !== undefined) {
    parts.push(node.time);
  }

  if (node.repeater !== undefined) {
    parts.push(node.repeater);
  }

  return `${open}${parts.join(" ")}${close}`;
}

function stringifyFootnoteReference(node: FootnoteReferenceNode): string {
  return `[fn:${node.label}]`;
}

function stringifyFootnoteDefinition(node: FootnoteDefinitionNode, ctx: InlineRenderContext): string {
  const content = stringifyInline(node.children, ctx);
  return content.length > 0 ? `[fn:${node.label}] ${content}` : `[fn:${node.label}]`;
}

function stringifyInlineNode(node: InlineNode, ctx: InlineRenderContext): string {
  switch (node.type) {
    case "text":
      return escapeInlineText(node.value, ctx.escapeChars);
    case "bold":
      return `*${stringifyInline(node.children, withEscapeChar(ctx, "*"))}*`;
    case "italic":
      return `/${stringifyInline(node.children, withEscapeChar(ctx, "/"))}/`;
    case "underline":
      return `_${stringifyInline(node.children, withEscapeChar(ctx, "_"))}_`;
    case "strike-through":
      return `+${stringifyInline(node.children, withEscapeChar(ctx, "+"))}+`;
    case "code":
      return `=${ctx.escapeDelimiters ? escapeInlineText(node.value, new Set(["="])) : node.value}=`;
    case "verbatim":
      return `~${ctx.escapeDelimiters ? escapeInlineText(node.value, new Set(["~"])) : node.value}~`;
    case "link":
      return stringifyLink(node, ctx);
    case "footnote-reference":
      return stringifyFootnoteReference(node);
    case "timestamp":
      return stringifyTimestamp(node);
    case "hard-break":
      return stringifyHardBreak();
    default:
      return assertNever(node);
  }
}

function stringifyLink(node: LinkNode, ctx: InlineRenderContext): string {
  if (node.description === undefined) {
    return `[[${node.url}]]`;
  }

  return `[[${node.url}][${stringifyInline(node.description, withEscapeChar(ctx, "]"))}]]`;
}

function stringifyHorizontalRule(): string {
  return "-----";
}

function stringifyHardBreak(): string {
  return "\\\n";
}

function formatCheckbox(checkbox: NonNullable<ListItem["checkbox"]>): string {
  return checkbox === "checked" ? "[X]" : "[ ]";
}

/** Indentation prepended to each nested list level when stringifying. */
const LIST_INDENT = "  ";

interface InlineRenderContext {
  readonly escapeDelimiters: boolean;
  readonly escapeChars: ReadonlySet<string>;
}

const EMPTY_ESCAPE_CHARS: ReadonlySet<string> = new Set();

const NO_CONTEXT: InlineRenderContext = {
  escapeDelimiters: true,
  escapeChars: EMPTY_ESCAPE_CHARS,
};

/**
 * Derive a child inline context that also escapes `char` (used when entering
 * an emphasis span or link description). Returns the same context when
 * escaping is disabled or `char` is already escaped.
 */
function withEscapeChar(ctx: InlineRenderContext, char: string): InlineRenderContext {
  if (!ctx.escapeDelimiters || ctx.escapeChars.has(char)) {
    return ctx;
  }

  return {
    escapeDelimiters: ctx.escapeDelimiters,
    escapeChars: new Set([...ctx.escapeChars, char]),
  };
}

/**
 * Escape backslashes and every character in `chars` with a leading backslash
 * so emphasis/code/link content round-trips safely through `parse`.
 */
function escapeInlineText(value: string, chars: ReadonlySet<string>): string {
  if (chars.size === 0) {
    return value;
  }

  let result = "";
  for (const char of value) {
    if (char === "\\") {
      result += "\\\\";
    } else if (chars.has(char)) {
      result += `\\${char}`;
    } else {
      result += char;
    }
  }

  return result;
}

/** Prepend `indent` to every line of a multi-line block (used for sub-lists). */
function indentLines(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join("\n");
}

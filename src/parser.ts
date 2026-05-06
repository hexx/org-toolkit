import type {
  DocumentMetadata,
  InlineNode,
  Heading,
  List,
  ListItem,
  ListItemCheckboxState,
  ListKind,
  Paragraph,
  Position,
  Root,
  SourceRange,
  Table,
  TableCell,
  TableRow,
  TableRowKind,
} from "./ast.js";
import { OrgParseError } from "./errors.js";

interface LineEntry {
  readonly text: string;
  readonly position: SourceRange;
}

interface ParsedListItemLine {
  readonly kind: ListKind;
  readonly item: ListItem;
}

interface ParsedTableRowLine {
  readonly row: TableRow;
}

const TODO_KEYWORDS = new Set([
  "TODO",
  "DONE",
  "CANCELLED",
  "CANCELED",
  "NEXT",
  "WAITING",
]);

/**
 * Parse an org-mode document into a minimal AST.
 *
 * This first-pass parser understands document metadata, headings, paragraphs,
 * lists, tables, and basic inline markup while preserving source positions for
 * every node.
 *
 * @example
 * ```ts
 * const root = parse("* TODO My First Heading :work:urgent:");
 * root.children[0]?.type; // "heading"
 * ```
 */
export function parse(text: string): Root {
  const lines = collectLineEntries(text);
  const metadata: DocumentMetadata[] = [];
  const children: Array<Heading | Paragraph | List | Table> = [];
  let paragraphBuffer: LineEntry[] = [];
  let listBuffer: ListItem[] = [];
  let listKind: ListKind | null = null;
  let tableBuffer: TableRow[] = [];

  const flushParagraph = (): void => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    const first = paragraphBuffer[0]!;
    const last = paragraphBuffer[paragraphBuffer.length - 1]!;
    const value = paragraphBuffer.map((entry) => entry.text).join("\n");
    const paragraphPosition = {
      start: first.position.start,
      end: last.position.end,
    };

    children.push({
      type: "paragraph",
      children: parseInline(value, paragraphPosition.start),
      position: paragraphPosition,
    });
    paragraphBuffer = [];
  };

  const flushList = (): void => {
    if (listBuffer.length === 0 || listKind === null) {
      return;
    }

    const first = listBuffer[0]!;
    const last = listBuffer[listBuffer.length - 1]!;
    children.push({
      type: "list",
      kind: listKind,
      children: [...listBuffer],
      position: {
        start: first.position.start,
        end: last.position.end,
      },
    });
    listBuffer = [];
    listKind = null;
  };

  const flushTable = (): void => {
    if (tableBuffer.length === 0) {
      return;
    }

    const first = tableBuffer[0]!;
    const last = tableBuffer[tableBuffer.length - 1]!;
    children.push({
      type: "table",
      children: [...tableBuffer],
      position: {
        start: first.position.start,
        end: last.position.end,
      },
    });
    tableBuffer = [];
  };

  for (const line of lines) {
    if (isBlankLine(line.text)) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (isMetadataLine(line.text)) {
      flushParagraph();
      flushList();
      flushTable();
      metadata.push(parseMetadataLine(line));
      continue;
    }

    const heading = parseHeadingLine(line);
    if (heading !== null) {
      flushParagraph();
      flushList();
      flushTable();
      children.push(heading);
      continue;
    }

    const tableRowLine = parseTableRowLine(line);
    if (tableRowLine !== null) {
      flushParagraph();
      flushList();
      tableBuffer = [...tableBuffer, tableRowLine.row];
      continue;
    }

    const listItemLine = parseListItemLine(line);
    if (listItemLine !== null) {
      flushParagraph();
      flushTable();
      if (listKind !== null && listKind !== listItemLine.kind) {
        flushList();
      }

      listBuffer = [...listBuffer, listItemLine.item];
      listKind = listItemLine.kind;
      continue;
    }

    flushTable();
    flushList();
    paragraphBuffer = [...paragraphBuffer, line];
  }

  flushParagraph();
  flushList();
  flushTable();

  const start = lines[0]?.position.start ?? createPosition(0, 1, 1);
  const end = lines[lines.length - 1]?.position.end ?? createPosition(0, 1, 1);

  return {
    type: "root",
    metadata,
    children,
    position: {
      start,
      end,
    },
  };
}

/**
 * A compatibility wrapper that exposes `Parser.parse()` as requested by the
 * CLI milestone.
 *
 * @example
 * ```ts
 * const ast = Parser.parse("* TODO Heading");
 * ```
 */
export class Parser {
  /**
   * Parse org-mode text into a root AST.
   *
   * @example
   * ```ts
   * const ast = Parser.parse("* TODO Heading");
   * ```
   */
  public static parse(text: string): Root {
    return parse(text);
  }
}

function collectLineEntries(text: string): ReadonlyArray<LineEntry> {
  const entries: LineEntry[] = [];
  let lineStartIndex = 0;
  let lineNumber = 1;

  for (let index = 0; index <= text.length; ) {
    const char = text[index];
    const atEnd = index === text.length;

    if (!atEnd && char !== "\n" && char !== "\r") {
      index += 1;
      continue;
    }

    const lineText = text.slice(lineStartIndex, index);
    const start = createPosition(lineStartIndex, lineNumber, 1);
    const end = createPosition(index, lineNumber, lineText.length + 1);
    entries.push({
      text: lineText,
      position: {
        start,
        end,
      },
    });

    if (atEnd) {
      break;
    }

    if (char === "\r" && text[index + 1] === "\n") {
      index += 2;
    } else {
      index += 1;
    }

    lineStartIndex = index;
    lineNumber += 1;
  }

  return entries;
}

function parseMetadataLine(line: LineEntry): DocumentMetadata {
  const match = line.text.match(/^#\+([A-Za-z0-9_-]+):[ \t]*(.*)$/);
  if (match === null) {
    throw new OrgParseError("Invalid metadata line", line.position.start);
  }

  const key = match[1];
  if (key === undefined) {
    throw new OrgParseError("Invalid metadata line", line.position.start);
  }

  return {
    type: "document-metadata",
    key,
    value: match[2] ?? "",
    position: line.position,
  };
}

function parseHeadingLine(line: LineEntry): Heading | null {
  const match = line.text.match(/^(\*+)([ \t]*)(.*)$/);
  if (match === null) {
    return null;
  }

  const stars = match[1];
  if (stars === undefined) {
    return null;
  }

  const spaces = match[2] ?? "";
  const level = stars.length;
  const content = match[3] ?? "";
  const { todoKeyword, rest, restOffset } =
    splitTodoKeyword(content);
  const { title, tags } = splitTrailingTags(rest);
  const titlePosition =
    title.length === 0
      ? line.position.start
      : createOffsetPosition(line.position.start, stars.length + spaces.length + restOffset);
  const children = parseInline(title, titlePosition);

  if (todoKeyword !== undefined) {
    return {
      type: "heading",
      level,
      todoKeyword,
      tags,
      children,
      position: line.position,
    };
  }

  return {
    type: "heading",
    level,
    tags,
    children,
    position: line.position,
  };
}

function parseListItemLine(line: LineEntry): ParsedListItemLine | null {
  const match = line.text.match(/^(\s*)([-+]|\d+[.)])([ \t]+)(.*)$/);
  if (match === null) {
    return null;
  }

  const leadingWhitespace = match[1] ?? "";
  const marker = match[2];
  if (marker === undefined) {
    return null;
  }
  const separator = match[3] ?? "";
  const remainder = match[4] ?? "";
  const kind: ListKind = /^[0-9]/.test(marker) ? "ordered" : "unordered";

  const checkboxMatch = remainder.match(/^(\[(?: |X|x)\])([ \t]+)?(.*)$/);
  let checkbox: ListItemCheckboxState = null;
  let content = remainder;
  let checkboxLength = 0;

  if (checkboxMatch !== null) {
    const rawCheckbox = checkboxMatch[1];
    if (rawCheckbox === undefined) {
      return null;
    }
    checkboxLength = rawCheckbox.length + (checkboxMatch[2]?.length ?? 0);
    content = checkboxMatch[3] ?? "";
    checkbox = rawCheckbox === "[ ]" ? "unchecked" : "checked";
  }

  const contentOffset =
    leadingWhitespace.length + marker.length + separator.length + checkboxLength;
  const contentPosition = createOffsetPosition(line.position.start, contentOffset);
  const children = parseInline(content, contentPosition);

  return {
    kind,
    item: {
      type: "list-item",
      marker,
      checkbox,
      children,
      position: line.position,
    },
  };
}

function parseTableRowLine(line: LineEntry): ParsedTableRowLine | null {
  const indentMatch = line.text.match(/^\s*/);
  const indent = indentMatch?.[0].length ?? 0;
  const content = line.text.slice(indent);
  if (!content.startsWith("|")) {
    return null;
  }

  const rowType: TableRowKind = isTableSeparatorLine(content) ? "separator" : "data";
  if (rowType === "separator") {
    return {
      row: {
        type: "table-row",
        rowType,
        children: [],
        position: line.position,
      },
    };
  }

  const cells = splitTableCells(content).map((segment) => {
    const trimmed = segment.raw.trim();
    const trimmedStart = segment.raw.length - segment.raw.trimStart().length;
    const cellOffset = indent + segment.start + trimmedStart;
    const cellPosition = {
      start: createOffsetPosition(line.position.start, cellOffset),
      end: createOffsetPosition(line.position.start, cellOffset + trimmed.length),
    };

    const cell: TableCell = {
      type: "table-cell",
      children: parseInline(trimmed, cellPosition.start),
      position: cellPosition,
    };

    return cell;
  });

  return {
    row: {
      type: "table-row",
      rowType,
      children: cells,
      position: line.position,
    },
  };
}

function splitTodoKeyword(content: string): {
  readonly todoKeyword?: string;
  readonly rest: string;
  readonly restOffset: number;
} {
  const trimmed = content.trimStart();
  const leadingWhitespace = content.length - trimmed.length;
  if (trimmed.length === 0) {
    return { rest: "", restOffset: leadingWhitespace };
  }

  const firstWhitespace = trimmed.search(/\s/);
  const keyword =
    firstWhitespace === -1 ? trimmed : trimmed.slice(0, firstWhitespace);
  if (!TODO_KEYWORDS.has(keyword)) {
    return { rest: trimmed, restOffset: leadingWhitespace };
  }

  const rest =
    firstWhitespace === -1 ? "" : trimmed.slice(firstWhitespace).trimStart();
  const restOffset = leadingWhitespace + (trimmed.length - rest.length);

  return {
    todoKeyword: keyword,
    rest,
    restOffset,
  };
}

function splitTrailingTags(content: string): {
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
} {
  const match = content.match(/^(.*?)(?:\s+:([A-Za-z0-9_@#%]+(?::[A-Za-z0-9_@#%]+)*)):\s*$/);
  if (match === null) {
    return {
      title: content.trimEnd(),
      tags: [],
    };
  }

  const title = match[1];
  const tagGroup = match[2];
  if (title === undefined || tagGroup === undefined) {
    return {
      title: content.trimEnd(),
      tags: [],
    };
  }

  const tags = tagGroup.split(":").filter((tag) => tag.length > 0);
  if (tags.some((tag) => !isValidTag(tag))) {
    return {
      title: content.trimEnd(),
      tags: [],
    };
  }

  return {
    title: title.trimEnd(),
    tags,
  };
}

function splitTableCells(content: string): ReadonlyArray<{
  readonly raw: string;
  readonly start: number;
}> {
  const parts = content.split("|");
  const segments: Array<{ readonly raw: string; readonly start: number }> = [];
  let offset = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const raw = parts[index] ?? "";
    const start = offset;
    offset += raw.length + 1;

    const isOuterLeadingEmpty = index === 0 && content.startsWith("|");
    const isOuterTrailingEmpty = index === parts.length - 1 && content.endsWith("|");
    if (isOuterLeadingEmpty || isOuterTrailingEmpty) {
      continue;
    }

    segments.push({
      raw,
      start,
    });
  }

  return segments;
}

function isTableSeparatorLine(content: string): boolean {
  const normalized = content.replace(/[ \t]/g, "");
  return normalized.length > 0 && /^[|+\-=]+$/.test(normalized);
}

function isMetadataLine(line: string): boolean {
  return /^#\+[A-Za-z0-9_-]+:/.test(line);
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function isValidTag(tag: string): boolean {
  return /^[A-Za-z0-9_@#%]+$/.test(tag);
}

function createPosition(
  index: number,
  line: number,
  column: number,
): Position {
  return { index, line, column };
}

function createOffsetPosition(position: Position, offset: number): Position {
  return {
    index: position.index + offset,
    line: position.line,
    column: position.column + offset,
  };
}

function parseInline(text: string, startPosition: Position): ReadonlyArray<InlineNode> {
  const nodes: InlineNode[] = [];
  let index = 0;
  let textStart = 0;

  const flushText = (endIndex: number): void => {
    if (endIndex <= textStart) {
      return;
    }

    nodes.push({
      type: "text",
      value: text.slice(textStart, endIndex),
      position: {
        start: createOffsetPosition(startPosition, textStart),
        end: createOffsetPosition(startPosition, endIndex),
      },
    });
  };

  while (index < text.length) {
    const marker = text[index];
    if (marker === undefined || !isInlineDelimiter(marker)) {
      index += 1;
      continue;
    }

    const closingIndex = text.indexOf(marker, index + 1);
    if (closingIndex === -1) {
      index += 1;
      continue;
    }

    flushText(index);

    const nodeStart = createOffsetPosition(startPosition, index);
    const nodeEnd = createOffsetPosition(startPosition, closingIndex + 1);
    const innerText = text.slice(index + 1, closingIndex);

    switch (marker) {
      case "*":
        nodes.push({
          type: "bold",
          children: parseInline(innerText, createOffsetPosition(startPosition, index + 1)),
          position: {
            start: nodeStart,
            end: nodeEnd,
          },
        });
        break;
      case "/":
        nodes.push({
          type: "italic",
          children: parseInline(innerText, createOffsetPosition(startPosition, index + 1)),
          position: {
            start: nodeStart,
            end: nodeEnd,
          },
        });
        break;
      case "_":
        nodes.push({
          type: "underline",
          children: parseInline(innerText, createOffsetPosition(startPosition, index + 1)),
          position: {
            start: nodeStart,
            end: nodeEnd,
          },
        });
        break;
      case "+":
        nodes.push({
          type: "strike-through",
          children: parseInline(innerText, createOffsetPosition(startPosition, index + 1)),
          position: {
            start: nodeStart,
            end: nodeEnd,
          },
        });
        break;
      case "=":
        nodes.push({
          type: "code",
          value: innerText,
          position: {
            start: nodeStart,
            end: nodeEnd,
          },
        });
        break;
      case "~":
        nodes.push({
          type: "verbatim",
          value: innerText,
          position: {
            start: nodeStart,
            end: nodeEnd,
          },
        });
        break;
      default:
        break;
    }

    index = closingIndex + 1;
    textStart = index;
  }

  flushText(text.length);
  return nodes;
}

function isInlineDelimiter(character: string): boolean {
  return character === "*" || character === "/" || character === "_" || character === "+" || character === "=" || character === "~";
}

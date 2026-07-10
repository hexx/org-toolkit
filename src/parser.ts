import type {
  Block,
  CommentNode,
  DocumentMetadata,
  FootnoteDefinitionNode,
  FootnoteReferenceNode,
  HardBreakNode,
  HorizontalRuleNode,
  InlineNode,
  Heading,
  List,
  ListItem,
  ListItemCheckboxState,
  ListKind,
  LinkNode,
  Planning,
  Paragraph,
  Position,
  Root,
  SourceRange,
  Table,
  TableCell,
  TableRow,
  TableRowKind,
  TimestampNode,
} from "./ast.js";
import { OrgParseError } from "./errors.js";
import {
  rememberBlankLinesAfter,
  rememberHeadingPlanningLines,
} from "./node-annotations.js";

type TopLevelNode =
  | Heading
  | Paragraph
  | List
  | Block
  | Table
  | FootnoteDefinitionNode
  | CommentNode
  | HorizontalRuleNode;

interface LineEntry {
  readonly text: string;
  readonly position: SourceRange;
}

interface ParsedListItemLine {
  readonly kind: ListKind;
  readonly indent: number;
  readonly item: ListItemBuilder;
}

interface ParsedTableRowLine {
  readonly row: TableRow;
}

/**
 * Mutable list builder used while reconstructing nested lists from indented
 * lines. Only the `subList`/`children` fields are mutated during tree
 * construction; the final tree is frozen into readonly AST nodes.
 */
interface ListItemBuilder {
  readonly type: "list-item";
  readonly marker: string;
  readonly checkbox: ListItemCheckboxState;
  readonly children: ReadonlyArray<InlineNode>;
  subList: ListBuilder | undefined;
  readonly position: SourceRange;
}

interface ListBuilder {
  readonly type: "list";
  readonly kind: ListKind;
  children: ListItemBuilder[];
  readonly position: SourceRange;
}

interface ListEntry {
  readonly indent: number;
  readonly kind: ListKind;
  readonly item: ListItemBuilder;
}

const ZERO_POSITION: Position = { index: 0, line: 1, column: 1 };

/** Characters that org-mode escapes with a leading backslash. */
const ESCAPE_CHARS = new Set(["*", "/", "_", "+", "=", "~", "[", "]", "\\"]);

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
  const metadata: Record<string, string> = {};
  const children: TopLevelNode[] = [];
  let paragraphBuffer: LineEntry[] = [];
  let listEntries: ListEntry[] = [];
  let tableBuffer: TableRow[] = [];
  let pendingBlankLines = 0;

  const pushChild = (child: TopLevelNode): void => {
    if (children.length > 0) {
      rememberBlankLinesAfter(children[children.length - 1]!, pendingBlankLines);
    }

    pendingBlankLines = 0;
    children.push(child);
  };

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

    pushChild({
      type: "paragraph",
      children: parseInline(value, paragraphPosition.start),
      position: paragraphPosition,
    });
    paragraphBuffer = [];
  };

  const flushList = (): void => {
    if (listEntries.length === 0) {
      return;
    }

    const list = buildListTree(listEntries);
    pushChild(list);
    listEntries = [];
  };

  const flushTable = (): void => {
    if (tableBuffer.length === 0) {
      return;
    }

    const first = tableBuffer[0]!;
    const last = tableBuffer[tableBuffer.length - 1]!;
    pushChild({
      type: "table",
      children: [...tableBuffer],
      position: {
        start: first.position.start,
        end: last.position.end,
      },
    });
    tableBuffer = [];
  };

  for (let index = 0; index < lines.length; ) {
    const line = lines[index]!;

    if (isBlankLine(line.text)) {
      flushParagraph();
      flushList();
      flushTable();
      pendingBlankLines += 1;
      index += 1;
      continue;
    }

    const block = parseBlockLine(lines, index, text);
    if (block !== null) {
      flushParagraph();
      flushList();
      flushTable();
      pushChild(block.block);
      index = block.nextIndex;
      continue;
    }

    if (isMetadataLine(line.text)) {
      flushParagraph();
      flushList();
      flushTable();
      const metadataEntry = parseMetadataLine(line);
      metadata[metadataEntry.key] = metadataEntry.value;
      index += 1;
      continue;
    }

    const heading = parseHeadingLine(lines, index, text);
    if (heading !== null) {
      flushParagraph();
      flushList();
      flushTable();
      pushChild(heading.heading);
      index = heading.nextIndex;
      continue;
    }

    const footnoteDefinition = parseFootnoteDefinitionLine(line);
    if (footnoteDefinition !== null) {
      flushParagraph();
      flushList();
      flushTable();
      pushChild(footnoteDefinition);
      index += 1;
      continue;
    }

    const comment = parseCommentLine(line);
    if (comment !== null) {
      flushParagraph();
      flushList();
      flushTable();
      pushChild(comment);
      index += 1;
      continue;
    }

    const horizontalRule = parseHorizontalRuleLine(line);
    if (horizontalRule !== null) {
      flushParagraph();
      flushList();
      flushTable();
      pushChild(horizontalRule);
      index += 1;
      continue;
    }

    const tableRowLine = parseTableRowLine(line);
    if (tableRowLine !== null) {
      flushParagraph();
      flushList();
      tableBuffer = [...tableBuffer, tableRowLine.row];
      index += 1;
      continue;
    }

    const listItemLine = parseListItemLine(line);
    if (listItemLine !== null) {
      flushParagraph();
      flushTable();
      listEntries = [...listEntries, {
        indent: listItemLine.indent,
        kind: listItemLine.kind,
        item: listItemLine.item,
      }];
      index += 1;
      continue;
    }

    flushTable();
    flushList();
    paragraphBuffer = [...paragraphBuffer, line];
    index += 1;
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
  // Only reached after `isMetadataLine` matched, which uses the same prefix
  // pattern, so the regex below always matches and the key capture is present.
  const match = line.text.match(/^#\+([A-Za-z_]+):[ \t]*(.*)$/i)!;
  const key = match[1]!;
  const value = match[2] ?? "";

  return {
    type: "document-metadata",
    key: key.toUpperCase(),
    value: value.trim(),
    position: line.position,
  };
}

interface ParsedHeadingLine {
  readonly heading: Heading;
  readonly nextIndex: number;
}

function parseHeadingLine(
  lines: ReadonlyArray<LineEntry>,
  startIndex: number,
  _text: string,
): ParsedHeadingLine | null {
  const line = lines[startIndex];
  if (line === undefined) {
    return null;
  }

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
  const { todoKeyword, rest, restOffset } = splitTodoKeyword(content);
  const { title, tags } = splitTrailingTags(rest);
  const titlePosition =
    title.length === 0
      ? line.position.start
      : createOffsetPosition(line.position.start, stars.length + spaces.length + restOffset);
  const children = parseInline(title, titlePosition);
  const planning = parsePlanningSection(lines, startIndex + 1);
  const propertyDrawer = parsePropertyDrawer(lines, planning?.nextIndex ?? startIndex + 1);
  const properties = propertyDrawer?.properties ?? {};
  const nextIndex = propertyDrawer?.nextIndex ?? planning?.nextIndex ?? startIndex + 1;
  const endPosition = propertyDrawer?.endPosition ?? planning?.endPosition ?? line.position.end;

  const heading: Heading = {
    type: "heading",
    level,
    tags,
    properties,
    ...(planning !== null ? { planning: planning.planning } : {}),
    children,
    position: {
      start: line.position.start,
      end: endPosition,
    },
    ...(todoKeyword !== undefined ? { todoKeyword } : {}),
  };

  if (planning !== null && planning.rawLines.length > 0) {
    rememberHeadingPlanningLines(heading, planning.rawLines);
  }

  return {
    heading,
    nextIndex,
  };
}

interface ParsedPlanningSection {
  readonly planning: Readonly<Planning>;
  readonly nextIndex: number;
  readonly endPosition: Position;
  readonly rawLines: ReadonlyArray<string>;
}

type MutablePlanning = {
  scheduled?: TimestampNode;
  deadline?: TimestampNode;
  closed?: TimestampNode;
};

function parsePlanningSection(
  lines: ReadonlyArray<LineEntry>,
  startIndex: number,
): ParsedPlanningSection | null {
  const planning: MutablePlanning = {};
  const rawLines: string[] = [];
  let nextIndex = startIndex;
  let endPosition: Position | null = null;
  let matchedAny = false;

  while (nextIndex < lines.length) {
    const line = lines[nextIndex];
    if (line === undefined) {
      break;
    }

    const parsed = parsePlanningLine(line);
    if (parsed === null) {
      break;
    }

    matchedAny = true;
    rawLines.push(line.text);
    endPosition = line.position.end;

    if (parsed.planning.scheduled !== undefined) {
      planning.scheduled = parsed.planning.scheduled;
    }

    if (parsed.planning.deadline !== undefined) {
      planning.deadline = parsed.planning.deadline;
    }

    if (parsed.planning.closed !== undefined) {
      planning.closed = parsed.planning.closed;
    }

    nextIndex += 1;
  }

  if (!matchedAny || endPosition === null) {
    return null;
  }

  return {
    planning: planning as Readonly<Planning>,
    nextIndex,
    endPosition,
    rawLines,
  };
}

interface ParsedPlanningLine {
  readonly planning: Readonly<Planning>;
}

function parsePlanningLine(line: LineEntry): ParsedPlanningLine | null {
  const planningPattern = /(?:^|\s)(SCHEDULED|DEADLINE|CLOSED):\s*(<[^>]+>|\[[^\]]+\])/gi;
  const planning: MutablePlanning = {};
  let matchedAny = false;
  let match: RegExpExecArray | null;

  while ((match = planningPattern.exec(line.text)) !== null) {
    const label = match[1]?.toLowerCase();
    const timestampText = match[2];
    if (label === undefined || timestampText === undefined) {
      continue;
    }

    const timestampStart = match.index + match[0].indexOf(timestampText);
    const timestamp = parseTimestampText(
      timestampText,
      createOffsetPosition(line.position.start, timestampStart),
    );
    if (timestamp === null) {
      throw new OrgParseError("Invalid planning timestamp", line.position.start);
    }

    matchedAny = true;
    switch (label) {
      case "scheduled":
        planning.scheduled = timestamp;
        break;
      case "deadline":
        planning.deadline = timestamp;
        break;
      case "closed":
        planning.closed = timestamp;
        break;
      default:
        break;
    }
  }

  if (!matchedAny) {
    return null;
  }

  return {
    planning: planning as Readonly<Planning>,
  };
}

interface ParsedPropertyDrawer {
  readonly properties: Readonly<Record<string, string>>;
  readonly nextIndex: number;
  readonly endPosition: Position;
}

function parsePropertyDrawer(
  lines: ReadonlyArray<LineEntry>,
  startIndex: number,
): ParsedPropertyDrawer | null {
  const startLine = lines[startIndex];
  if (startLine === undefined || !/^:PROPERTIES:\s*$/i.test(startLine.text)) {
    return null;
  }

  const properties: Record<string, string> = {};

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }

    if (/^:END:\s*$/i.test(line.text)) {
      return {
        properties,
        nextIndex: index + 1,
        endPosition: line.position.end,
      };
    }

    const match = line.text.match(/^:([A-Za-z_]+):[ \t]*(.*)$/i);
    if (match === null) {
      throw new OrgParseError("Invalid property drawer line", line.position.start);
    }

    const key = match[1];
    if (key === undefined) {
      throw new OrgParseError("Invalid property drawer line", line.position.start);
    }

    properties[key.toUpperCase()] = (match[2] ?? "").trim();
  }

  throw new OrgParseError("Unterminated property drawer", startLine.position.start);
}

interface ParsedBlockLine {
  readonly block: Block;
  readonly nextIndex: number;
}

function parseBlockLine(
  lines: ReadonlyArray<LineEntry>,
  startIndex: number,
  text: string,
): ParsedBlockLine | null {
  const line = lines[startIndex];
  if (line === undefined) {
    return null;
  }

  const match = line.text.match(/^#\+begin_([A-Za-z0-9_-]+)(?:[ \t]+(.*))?$/i);
  if (match === null) {
    return null;
  }

  const rawBlockName = match[1];
  if (rawBlockName === undefined) {
    return null;
  }

  const blockName = rawBlockName.toUpperCase();
  const parameters = (match[2] ?? "").trim();

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index];
    if (candidate === undefined) {
      break;
    }

    const endMatch = candidate.text.match(/^#\+end_([A-Za-z0-9_-]+)\s*$/i);
    if (endMatch === null) {
      continue;
    }

    const rawEndName = endMatch[1];
    if (rawEndName === undefined || rawEndName.toUpperCase() !== blockName) {
      continue;
    }

    return {
      block: {
        type: "block",
        blockName,
        parameters,
        content: text.slice(line.position.end.index, candidate.position.start.index),
        position: {
          start: line.position.start,
          end: candidate.position.end,
        },
      },
      nextIndex: index + 1,
    };
  }

  throw new OrgParseError(`Unterminated block: ${blockName}`, line.position.start);
}

function parseFootnoteDefinitionLine(line: LineEntry): FootnoteDefinitionNode | null {
  const match = line.text.match(/^\[fn:([^\]]+)\]\s*(.*)$/);
  if (match === null) {
    return null;
  }

  const label = match[1];
  if (label === undefined || label.length === 0) {
    return null;
  }

  const description = match[2] ?? "";
  const descriptionOffset = line.text.length - description.length;

  return {
    type: "footnote-definition",
    label,
    children: parseInline(description, createOffsetPosition(line.position.start, descriptionOffset)),
    position: line.position,
  };
}

function parseCommentLine(line: LineEntry): CommentNode | null {
  const match = line.text.match(/^[ \t]*# (.*)$/);
  if (match === null) {
    return null;
  }

  return {
    type: "comment",
    content: match[1] ?? "",
    position: line.position,
  };
}

function parseHorizontalRuleLine(line: LineEntry): HorizontalRuleNode | null {
  if (!/^[ \t]*-{5,}[ \t]*$/.test(line.text)) {
    return null;
  }

  return {
    type: "horizontal-rule",
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
    indent: leadingWhitespace.length,
    item: {
      type: "list-item",
      marker,
      checkbox,
      children,
      subList: undefined,
      position: line.position,
    },
  };
}

/**
 * Build a nested `List` tree from flat, indent-annotated list item entries.
 *
 * Items with a deeper indent than the previous item become children of that
 * item's `subList`. Items at the same or shallower indent pop the stack back to
 * the matching level, mirroring how org-mode reconstructs nesting from
 * indentation.
 */
function buildListTree(entries: ReadonlyArray<ListEntry>): List {
  const topChildren: ListItemBuilder[] = [];
  const stack: Array<{ readonly indent: number; readonly item: ListItemBuilder }> = [];

  for (const entry of entries) {
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= entry.indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      topChildren.push(entry.item);
    } else {
      const parent = stack[stack.length - 1]!.item;
      if (parent.subList === undefined) {
        parent.subList = {
          type: "list",
          kind: entry.kind,
          children: [],
          position: entry.item.position,
        };
      }
      parent.subList.children.push(entry.item);
    }

    stack.push({ indent: entry.indent, item: entry.item });
  }

  const first = entries[0]!.item;
  const last = entries[entries.length - 1]!.item;
  return {
    type: "list",
    kind: entries[0]!.kind,
    children: topChildren.map(freezeListItem),
    position: {
      start: first.position.start,
      end: last.position.end,
    },
  };
}

function freezeListItem(item: ListItemBuilder): ListItem {
  const subList = item.subList === undefined ? undefined : freezeSubList(item.subList);
  return {
    type: "list-item",
    marker: item.marker,
    checkbox: item.checkbox,
    children: item.children,
    ...(subList !== undefined ? { subList } : {}),
    position: item.position,
  };
}

function freezeSubList(list: ListBuilder): List {
  const children = list.children.map(freezeListItem);
  const first = children[0];
  const last = children[children.length - 1];
  return {
    type: "list",
    kind: list.kind,
    children,
    position:
      first !== undefined && last !== undefined
        ? { start: first.position.start, end: itemEffectiveEnd(last) }
        : list.position,
  };
}

function itemEffectiveEnd(item: ListItem): Position {
  return item.subList !== undefined ? item.subList.position.end : item.position.end;
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
  return /^#\+[A-Za-z_]+:/i.test(line);
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

/**
 * Parse org-mode inline markup (bold, italic, code, links, timestamps,
 * footnote references, hard breaks, and backslash escapes) into inline AST
 * nodes without any surrounding block structure.
 *
 * This is the same inline parser used by {@link parse}; exposing it lets
 * external apps that manage their own block structure delegate only the inline
 * decoration to org-toolkit.
 *
 * `startPosition` is optional and defaults to a zero position, which is
 * convenient when the caller does not track source offsets.
 *
 * @example
 * ```ts
 * const nodes = parseInline("hello *bold* and [[https://example.com][link]]");
 * // → [TextNode, BoldNode, TextNode, LinkNode]
 * ```
 */
export function parseInline(text: string, startPosition?: Position): ReadonlyArray<InlineNode> {
  const start = startPosition ?? ZERO_POSITION;
  const nodes: InlineNode[] = [];
  let index = 0;
  let textBuffer = "";
  let textStart = 0;

  const flushText = (endIndex: number): void => {
    if (textBuffer.length === 0) {
      return;
    }

    nodes.push({
      type: "text",
      value: textBuffer,
      position: {
        start: createOffsetPosition(start, textStart),
        end: createOffsetPosition(start, endIndex),
      },
    });
    textBuffer = "";
  };

  const beginTextRun = (): void => {
    if (textBuffer.length === 0) {
      textStart = index;
    }
  };

  while (index < text.length) {
    const char = text[index];

    if (char === "\\") {
      const next = text[index + 1];

      if (next === "\n") {
        flushText(index);
        nodes.push({
          type: "hard-break",
          position: {
            start: createOffsetPosition(start, index),
            end: createOffsetPosition(start, index + 2),
          },
        } satisfies HardBreakNode);
        index += 2;
        textStart = index;
        continue;
      }

      if (next !== undefined && ESCAPE_CHARS.has(next)) {
        beginTextRun();
        textBuffer += next;
        index += 2;
        continue;
      }

      beginTextRun();
      textBuffer += "\\";
      index += 1;
      continue;
    }

    const footnoteReference = parseFootnoteReferenceAt(text, start, index);
    if (footnoteReference !== null) {
      flushText(index);
      nodes.push(footnoteReference.node);
      index = footnoteReference.nextIndex;
      textStart = index;
      continue;
    }

    const timestamp = parseTimestampAt(text, start, index);
    if (timestamp !== null) {
      flushText(index);
      nodes.push(timestamp.node);
      index = timestamp.nextIndex;
      textStart = index;
      continue;
    }

    const link = parseLink(text, start, index);
    if (link !== null) {
      flushText(index);
      nodes.push(link.node);
      index = link.nextIndex;
      textStart = index;
      continue;
    }

    const emphasis = parseEmphasisAt(text, start, index);
    if (emphasis !== null) {
      flushText(index);
      nodes.push(emphasis.node);
      index = emphasis.nextIndex;
      textStart = index;
      continue;
    }

    beginTextRun();
    textBuffer += char;
    index += 1;
  }

  flushText(text.length);
  return nodes;
}

interface ParsedEmphasis {
  readonly node: InlineNode;
  readonly nextIndex: number;
}

const EMPHASIS_MARKER_TO_TYPE = {
  "*": "bold",
  "/": "italic",
  "_": "underline",
  "+": "strike-through",
  "=": "code",
  "~": "verbatim",
} as const;

type EmphasisType = (typeof EMPHASIS_MARKER_TO_TYPE)[keyof typeof EMPHASIS_MARKER_TO_TYPE];

/** Characters allowed immediately before an opening emphasis marker. */
const EMPHASIS_PRE_CHARS = " \t('\"{";
/** Characters allowed immediately after a closing emphasis marker. */
const EMPHASIS_POST_CHARS = "\t\n .,!?;:'\")}-";
/** Characters not allowed at the inner border of emphasized content. */
const EMPHASIS_BORDER_CHARS = " \t\n.,;:!?";

/**
 * Parse an org-mode emphasis span starting at `index`.
 *
 * Implements the border rules from `org-emphasis-regexp-components`: the
 * opening marker must be preceded by a border character (or start of text),
 * the closing marker must be followed by a border character (or end of
 * text), and the content cannot start or end with a forbidden border
 * character. This prevents `2 * 3 * 4` from being misread as bold while
 * keeping `*bold*` valid.
 */
function parseEmphasisAt(
  text: string,
  startPosition: Position,
  index: number,
): ParsedEmphasis | null {
  const marker = text[index];
  if (marker === undefined || !isInlineDelimiter(marker)) {
    return null;
  }

  if (!isEmphasisPreBorder(text, index)) {
    return null;
  }

  const nodeType: EmphasisType = EMPHASIS_MARKER_TO_TYPE[marker];
  let search = index + 1;

  while (search < text.length) {
    const close = text.indexOf(marker, search);
    if (close === -1) {
      return null;
    }

    if (!isEmphasisPostBorder(text, close)) {
      search = close + 1;
      continue;
    }

    if (isEscaped(text, close)) {
      search = close + 1;
      continue;
    }

    const innerText = text.slice(index + 1, close);
    if (innerText.length === 0 || hasEmphasisBorderViolation(innerText)) {
      search = close + 1;
      continue;
    }

    const nodeStart = createOffsetPosition(startPosition, index);
    const nodeEnd = createOffsetPosition(startPosition, close + 1);

    if (nodeType === "code" || nodeType === "verbatim") {
      return {
        node: {
          type: nodeType,
          value: unescapeInlineText(innerText),
          position: {
            start: nodeStart,
            end: nodeEnd,
          },
        },
        nextIndex: close + 1,
      };
    }

    return {
      node: {
        type: nodeType,
        children: parseInline(innerText, createOffsetPosition(startPosition, index + 1)),
        position: {
          start: nodeStart,
          end: nodeEnd,
        },
      },
      nextIndex: close + 1,
    };
  }

  return null;
}

function isEmphasisPreBorder(text: string, markerIndex: number): boolean {
  if (markerIndex === 0) {
    return true;
  }

  const previous = text[markerIndex - 1];
  return previous !== undefined && EMPHASIS_PRE_CHARS.includes(previous);
}

function isEmphasisPostBorder(text: string, markerIndex: number): boolean {
  const afterIndex = markerIndex + 1;
  if (afterIndex >= text.length) {
    return true;
  }

  const after = text[afterIndex];
  return after !== undefined && EMPHASIS_POST_CHARS.includes(after);
}

function hasEmphasisBorderViolation(content: string): boolean {
  if (content.length === 0) {
    return false;
  }

  const first = content[0];
  const last = content[content.length - 1];
  return (
    (first !== undefined && EMPHASIS_BORDER_CHARS.includes(first)) ||
    (last !== undefined && EMPHASIS_BORDER_CHARS.includes(last))
  );
}

interface ParsedTimestamp {
  readonly node: TimestampNode;
  readonly nextIndex: number;
}

interface ParsedFootnoteReference {
  readonly node: FootnoteReferenceNode;
  readonly nextIndex: number;
}

function parseFootnoteReferenceAt(
  text: string,
  startPosition: Position,
  index: number,
): ParsedFootnoteReference | null {
  if (!text.startsWith("[fn:", index)) {
    return null;
  }

  const closingIndex = text.indexOf("]", index + 4);
  if (closingIndex === -1) {
    return null;
  }

  const label = text.slice(index + 4, closingIndex).trim();
  if (label.length === 0) {
    return null;
  }

  return {
    node: {
      type: "footnote-reference",
      label,
      position: {
        start: createOffsetPosition(startPosition, index),
        end: createOffsetPosition(startPosition, closingIndex + 1),
      },
    },
    nextIndex: closingIndex + 1,
  };
}

function parseTimestampAt(
  text: string,
  startPosition: Position,
  index: number,
): ParsedTimestamp | null {
  const opening = text[index];
  if (opening !== "<" && opening !== "[") {
    return null;
  }

  const closing = opening === "<" ? ">" : "]";
  const closingIndex = text.indexOf(closing, index + 1);
  if (closingIndex === -1) {
    return null;
  }

  const rawText = text.slice(index, closingIndex + 1);
  const node = parseTimestampText(rawText, createOffsetPosition(startPosition, index));
  if (node === null) {
    return null;
  }

  return {
    node,
    nextIndex: closingIndex + 1,
  };
}

function parseTimestampText(rawText: string, position: Position): TimestampNode | null {
  if ((rawText.startsWith("<") && !rawText.endsWith(">")) || (rawText.startsWith("[") && !rawText.endsWith("]"))) {
    return null;
  }

  const opening = rawText[0];
  const closing = rawText[rawText.length - 1];
  if ((opening !== "<" && opening !== "[") || (closing !== ">" && closing !== "]")) {
    return null;
  }

  const isActive = opening === "<";
  const inner = rawText.slice(1, -1).trim();
  const match = inner.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(.*))?$/);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const details = match[4]?.trim();
  const tokens = details === undefined || details.length === 0 ? [] : details.split(/\s+/);
  const repeaterIndex = findLastMatchingIndex(tokens, isRepeaterToken);
  const repeater = repeaterIndex === -1 ? undefined : tokens.splice(repeaterIndex, 1)[0];
  const timeIndex = findLastMatchingIndex(tokens, (token) => /^\d{2}:\d{2}$/.test(token));
  const time = timeIndex === -1 ? undefined : tokens.splice(timeIndex, 1)[0];
  const weekdayIndex = findLastMatchingIndex(tokens, isWeekdayToken);
  const weekday =
    weekdayIndex === -1 ? undefined : computeWeekday(year, month, day);
  if (weekdayIndex !== -1) {
    tokens.splice(weekdayIndex, 1);
  }

  const timestamp: TimestampNode = {
    type: "timestamp",
    isActive,
    year,
    month,
    day,
    ...(time !== undefined ? { time } : {}),
    ...(weekday !== undefined ? { weekday } : {}),
    ...(repeater !== undefined ? { repeater } : {}),
    position: {
      start: position,
      end: createOffsetPosition(position, rawText.length),
    },
  };

  return timestamp;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Compute the weekday label for a date, or `undefined` when the components
 * do not form a valid calendar date (e.g. `2026-02-30`). Validating avoids
 * `Date.UTC` silently rolling invalid values over into the next month.
 */
function computeWeekday(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return WEEKDAY_LABELS[date.getUTCDay()];
}

function isWeekdayToken(token: string): boolean {
  return /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/i.test(token);
}

function isRepeaterToken(token: string): boolean {
  return /^([.+-]?\+?\d+[dwmyh])(?:[A-Za-z].*)?$/.test(token);
}

function findLastMatchingIndex(
  values: ReadonlyArray<string>,
  predicate: (value: string) => boolean,
): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== undefined && predicate(value)) {
      return index;
    }
  }

  return -1;
}

function isInlineDelimiter(
  character: string,
): character is keyof typeof EMPHASIS_MARKER_TO_TYPE {
  return (
    character === "*" ||
    character === "/" ||
    character === "_" ||
    character === "+" ||
    character === "=" ||
    character === "~"
  );
}

/**
 * Determine whether the character at `index` is preceded by an odd run of
 * backslashes, meaning it is escaped and should not be treated as a marker.
 */
function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let pos = index - 1; pos >= 0 && text[pos] === "\\"; pos -= 1) {
    backslashes += 1;
  }

  return backslashes % 2 === 1;
}

/** Resolve org-mode backslash escapes (e.g. `\*` -> `*`, `\\` -> `\`). */
function unescapeInlineText(text: string): string {
  return text.replace(/\\([*/_+=~\\[\]])/g, "$1");
}

interface ParsedLink {
  readonly node: LinkNode;
  readonly nextIndex: number;
}

function parseLink(
  text: string,
  startPosition: Position,
  index: number,
): ParsedLink | null {
  if (text[index] !== "[" || text[index + 1] !== "[") {
    return null;
  }

  const closingIndex = text.indexOf("]]", index + 2);
  if (closingIndex === -1) {
    return null;
  }

  const inside = text.slice(index + 2, closingIndex);
  const separatorIndex = inside.indexOf("][");
  const url = separatorIndex === -1 ? inside : inside.slice(0, separatorIndex);
  const descriptionText = separatorIndex === -1 ? undefined : inside.slice(separatorIndex + 2);
  const nodeStart = createOffsetPosition(startPosition, index);
  const nodeEnd = createOffsetPosition(startPosition, closingIndex + 2);
  const description =
    descriptionText === undefined
      ? undefined
      : parseInline(
          descriptionText,
          createOffsetPosition(startPosition, index + 2 + (separatorIndex === -1 ? 0 : separatorIndex + 2)),
        );

  return {
    node: {
      type: "link",
      url,
      description,
      position: {
        start: nodeStart,
        end: nodeEnd,
      },
    },
    nextIndex: closingIndex + 2,
  };
}

import type {
  DocumentMetadata,
  Heading,
  Paragraph,
  Position,
  Root,
  SourceRange,
  Text,
} from "./ast.js";
import { OrgParseError } from "./errors.js";

interface LineEntry {
  readonly text: string;
  readonly position: SourceRange;
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
 * This first-pass parser understands document metadata, headings, and
 * paragraphs while preserving source positions for every node.
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
  const children: Array<Heading | Paragraph> = [];
  let paragraphBuffer: LineEntry[] = [];

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
    const textNode: Text = {
      type: "text",
      value,
      position: paragraphPosition,
    };

    children.push({
      type: "paragraph",
      children: [textNode],
      position: paragraphPosition,
    });
    paragraphBuffer = [];
  };

  for (const line of lines) {
    if (isBlankLine(line.text)) {
      flushParagraph();
      continue;
    }

    if (isMetadataLine(line.text)) {
      flushParagraph();
      metadata.push(parseMetadataLine(line));
      continue;
    }

    const heading = parseHeadingLine(line);
    if (heading !== null) {
      flushParagraph();
      children.push(heading);
      continue;
    }

    paragraphBuffer = [...paragraphBuffer, line];
  }

  flushParagraph();

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
  const match = line.text.match(/^(\*+)[ \t]*(.*)$/);
  if (match === null) {
    return null;
  }

  const stars = match[1];
  if (stars === undefined) {
    return null;
  }

  const level = stars.length;
  const content = match[2] ?? "";
  const { todoKeyword, title: titleWithPossibleTags } =
    splitTodoKeyword(content);
  const { title, tags } = splitTrailingTags(titleWithPossibleTags);

  if (todoKeyword !== undefined) {
    return {
      type: "heading",
      level,
      todoKeyword,
      title,
      tags,
      children: [],
      position: line.position,
    };
  }

  return {
    type: "heading",
    level,
    title,
    tags,
    children: [],
    position: line.position,
  };
}

function splitTodoKeyword(content: string): {
  readonly todoKeyword?: string;
  readonly title: string;
} {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { title: "" };
  }

  const firstWhitespace = trimmed.search(/\s/);
  const keyword =
    firstWhitespace === -1 ? trimmed : trimmed.slice(0, firstWhitespace);
  if (!TODO_KEYWORDS.has(keyword)) {
    return { title: trimmed };
  }

  const title =
    firstWhitespace === -1 ? "" : trimmed.slice(firstWhitespace).trimStart();

  return {
    todoKeyword: keyword,
    title,
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

function isMetadataLine(line: string): boolean {
  return /^#\+[A-Za-z0-9_-]+:/.test(line);
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t";
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

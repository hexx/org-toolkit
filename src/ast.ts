/**
 * A source position in the original org document.
 *
 * Positions are 1-based for line and column, and 0-based for the absolute
 * character index.
 *
 * @example
 * ```ts
 * const position: Position = { index: 0, line: 1, column: 1 };
 * ```
 */
export interface Position {
  readonly index: number;
  readonly line: number;
  readonly column: number;
}

/**
 * A half-open source range for an AST node.
 *
 * The `start` position points at the first character owned by the node and the
 * `end` position points just after the last character.
 *
 * @example
 * ```ts
 * const range: SourceRange = {
 *   start: { index: 0, line: 1, column: 1 },
 *   end: { index: 5, line: 1, column: 6 },
 * };
 * ```
 */
export interface SourceRange {
  readonly start: Position;
  readonly end: Position;
}

/**
 * Base shape shared by every AST node.
 */
export interface NodeBase {
  readonly position: SourceRange;
}

/**
 * The root node of a parsed org document.
 *
 * It owns the top-level metadata entries and the structural body nodes such as
 * headings and paragraphs.
 *
 * @example
 * ```ts
 * const root: Root = {
 *   type: "root",
 *   metadata: [],
 *   children: [],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 0, line: 1, column: 1 },
 *   },
 * };
 * ```
 */
export interface Root extends NodeBase {
  readonly type: "root";
  readonly metadata: ReadonlyArray<DocumentMetadata>;
  readonly children: ReadonlyArray<Heading | Paragraph>;
}

/**
 * A document-level metadata entry such as `#+TITLE:` or `#+AUTHOR:`.
 *
 * @example
 * ```ts
 * const metadata: DocumentMetadata = {
 *   type: "document-metadata",
 *   key: "TITLE",
 *   value: "My Note",
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 15, line: 1, column: 16 },
 *   },
 * };
 * ```
 */
export interface DocumentMetadata extends NodeBase {
  readonly type: "document-metadata";
  readonly key: string;
  readonly value: string;
}

/**
 * A heading node parsed from a line that starts with one or more `*`
 * characters.
 *
 * The parser keeps the heading extensible by storing the level, an optional
 * TODO keyword, the plain title, and trailing tags.
 *
 * @example
 * ```ts
 * const heading: Heading = {
 *   type: "heading",
 *   level: 1,
 *   todoKeyword: "TODO",
 *   title: "My First Heading",
 *   tags: ["work", "urgent"],
 *   children: [],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 37, line: 1, column: 38 },
 *   },
 * };
 * ```
 */
export interface Heading extends NodeBase {
  readonly type: "heading";
  readonly level: number;
  readonly todoKeyword?: string;
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly children: ReadonlyArray<Paragraph>;
}

/**
 * A paragraph node that owns one or more text nodes.
 *
 * @example
 * ```ts
 * const paragraph: Paragraph = {
 *   type: "paragraph",
 *   children: [
 *     {
 *       type: "text",
 *       value: "Hello world",
 *       position: {
 *         start: { index: 0, line: 1, column: 1 },
 *         end: { index: 11, line: 1, column: 12 },
 *       },
 *     },
 *   ],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 11, line: 1, column: 12 },
 *   },
 * };
 * ```
 */
export interface Paragraph extends NodeBase {
  readonly type: "paragraph";
  readonly children: ReadonlyArray<Text>;
}

/**
 * A leaf text node used inside paragraphs.
 *
 * @example
 * ```ts
 * const text: Text = {
 *   type: "text",
 *   value: "Hello world",
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 11, line: 1, column: 12 },
 *   },
 * };
 * ```
 */
export interface Text extends NodeBase {
  readonly type: "text";
  readonly value: string;
}

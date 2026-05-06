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
  readonly children: ReadonlyArray<Heading | Paragraph | List | Table>;
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
 * The category of a list node.
 *
 * @example
 * ```ts
 * const kind: ListKind = "unordered";
 * ```
 */
export type ListKind = "unordered" | "ordered";

/**
 * The checkbox state attached to a list item.
 *
 * @example
 * ```ts
 * const checkbox: ListItemCheckboxState = "checked";
 * ```
 */
export type ListItemCheckboxState = "checked" | "unchecked" | null;

/**
 * A text node or formatting node that can appear inside block content.
 *
 * @example
 * ```ts
 * const inline: InlineNode = {
 *   type: "bold",
 *   children: [{ type: "text", value: "Important", position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 9, line: 1, column: 10 },
 *   }}],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 11, line: 1, column: 12 },
 *   },
 * };
 * ```
 */
export type InlineNode =
  | TextNode
  | BoldNode
  | ItalicNode
  | UnderlineNode
  | CodeNode
  | VerbatimNode
  | StrikeThroughNode;

/**
 * A heading node parsed from a line that starts with one or more `*`
 * characters.
 *
 * The parser keeps the heading extensible by storing the level, an optional
 * TODO keyword, inline children, and trailing tags.
 *
 * @example
 * ```ts
 * const heading: Heading = {
 *   type: "heading",
 *   level: 1,
 *   todoKeyword: "TODO",
 *   tags: ["work", "urgent"],
 *   children: [{ type: "text", value: "My First Heading", position: {
 *     start: { index: 7, line: 1, column: 8 },
 *     end: { index: 23, line: 1, column: 24 },
 *   }}],
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
  readonly tags: ReadonlyArray<string>;
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * A paragraph node that owns one or more inline nodes.
 *
 * @example
 * ```ts
 * const paragraph: Paragraph = {
 *   type: "paragraph",
 *   children: [
 *     { type: "text", value: "Hello world", position: {
 *       start: { index: 0, line: 1, column: 1 },
 *       end: { index: 11, line: 1, column: 12 },
 *     }},
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
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * A list node that groups consecutive list items of the same kind.
 *
 * @example
 * ```ts
 * const list: List = {
 *   type: "list",
 *   kind: "unordered",
 *   children: [],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 0, line: 1, column: 1 },
 *   },
 * };
 * ```
 */
export interface List extends NodeBase {
  readonly type: "list";
  readonly kind: ListKind;
  readonly children: ReadonlyArray<ListItem>;
}

/**
 * A single list item with its marker, checkbox state, and inline children.
 *
 * @example
 * ```ts
 * const item: ListItem = {
 *   type: "list-item",
 *   marker: "-",
 *   checkbox: "unchecked",
 *   children: [{ type: "text", value: "Task", position: {
 *     start: { index: 2, line: 1, column: 3 },
 *     end: { index: 6, line: 1, column: 7 },
 *   }}],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 8, line: 1, column: 9 },
 *   },
 * };
 * ```
 */
export interface ListItem extends NodeBase {
  readonly type: "list-item";
  readonly marker: string;
  readonly checkbox: ListItemCheckboxState;
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * The kind of a table row.
 *
 * @example
 * ```ts
 * const rowType: TableRowKind = "data";
 * ```
 */
export type TableRowKind = "data" | "separator";

/**
 * A table node that groups consecutive table rows.
 *
 * @example
 * ```ts
 * const table: Table = {
 *   type: "table",
 *   children: [],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 0, line: 1, column: 1 },
 *   },
 * };
 * ```
 */
export interface Table extends NodeBase {
  readonly type: "table";
  readonly children: ReadonlyArray<TableRow>;
}

/**
 * A row inside an org-mode table.
 *
 * Data rows contain cell children. Separator rows are the horizontal rules
 * used to split headers and body content.
 *
 * @example
 * ```ts
 * const row: TableRow = {
 *   type: "table-row",
 *   rowType: "data",
 *   children: [],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 0, line: 1, column: 1 },
 *   },
 * };
 * ```
 */
export interface TableRow extends NodeBase {
  readonly type: "table-row";
  readonly rowType: TableRowKind;
  readonly children: ReadonlyArray<TableCell>;
}

/**
 * A single cell within a table row.
 *
 * @example
 * ```ts
 * const cell: TableCell = {
 *   type: "table-cell",
 *   children: [{ type: "text", value: "Alice", position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 5, line: 1, column: 6 },
 *   }}],
 *   position: {
 *     start: { index: 0, line: 1, column: 1 },
 *     end: { index: 5, line: 1, column: 6 },
 *   },
 * };
 * ```
 */
export interface TableCell extends NodeBase {
  readonly type: "table-cell";
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * A plain text node used inside inline content.
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
export interface TextNode extends NodeBase {
  readonly type: "text";
  readonly value: string;
}

/**
 * Bold inline text.
 */
export interface BoldNode extends NodeBase {
  readonly type: "bold";
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * Italic inline text.
 */
export interface ItalicNode extends NodeBase {
  readonly type: "italic";
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * Underlined inline text.
 */
export interface UnderlineNode extends NodeBase {
  readonly type: "underline";
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * Inline code surrounded by `=` in org-mode.
 */
export interface CodeNode extends NodeBase {
  readonly type: "code";
  readonly value: string;
}

/**
 * Verbatim inline text surrounded by `~` in org-mode.
 */
export interface VerbatimNode extends NodeBase {
  readonly type: "verbatim";
  readonly value: string;
}

/**
 * Strikethrough inline text.
 */
export interface StrikeThroughNode extends NodeBase {
  readonly type: "strike-through";
  readonly children: ReadonlyArray<InlineNode>;
}

/**
 * Backwards-compatible alias for plain text inline nodes.
 */
export type Text = TextNode;

/**
 * Any AST node produced by the parser.
 *
 * @example
 * ```ts
 * function acceptsNode(node: ASTNode): void {
 *   void node.type;
 * }
 * ```
 */
export type ASTNode =
  | Root
  | DocumentMetadata
  | Heading
  | Paragraph
  | List
  | ListItem
  | Table
  | TableRow
  | TableCell
  | InlineNode;

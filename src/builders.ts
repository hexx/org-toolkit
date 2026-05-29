import type {
  Heading,
  InlineNode,
  List,
  ListItem,
  ListItemCheckboxState,
  Paragraph,
  Position,
  Root,
  SourceRange,
  TextNode,
} from "./ast.js";

const ZERO_POSITION: Position = {
  index: 0,
  line: 1,
  column: 1,
};

/**
 * Create a zero-length source range for synthetic AST nodes.
 *
 * This keeps builder-generated nodes compatible with the parser's strict
 * position requirements without forcing callers to fabricate offsets.
 */
function createSyntheticRange(): SourceRange {
  return {
    start: { ...ZERO_POSITION },
    end: { ...ZERO_POSITION },
  };
}

/**
 * Create a root AST node with synthetic source positions.
 *
 * @example
 * ```ts
 * const root = createRoot({ TITLE: "Notes" }, []);
 * ```
 */
export function createRoot(
  metadata: Readonly<Record<string, string>>,
  children: ReadonlyArray<Root["children"][number]>,
): Root {
  return {
    type: "root",
    metadata: { ...metadata },
    children: [...children],
    position: createSyntheticRange(),
  };
}

/**
 * Create a heading node from plain text content.
 *
 * @example
 * ```ts
 * const heading = createHeading(1, "Ship it", { todoKeyword: "TODO" });
 * ```
 */
export function createHeading(
  level: number,
  text: string,
  options: {
    readonly todoKeyword?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly properties?: Readonly<Record<string, string>>;
  } = {},
): Heading {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError("Heading level must be a positive integer");
  }

  return {
    type: "heading",
    level,
    tags: [...(options.tags ?? [])],
    properties: { ...(options.properties ?? {}) },
    children: text.length > 0 ? [createPlainText(text)] : [],
    position: createSyntheticRange(),
    ...(options.todoKeyword === undefined ? {} : { todoKeyword: options.todoKeyword }),
  };
}

/**
 * Create a paragraph node from either a plain string or inline children.
 *
 * @example
 * ```ts
 * const paragraph = createParagraph("Hello world");
 * ```
 */
export function createParagraph(textOrNodes: string | ReadonlyArray<InlineNode>): Paragraph {
  const children = typeof textOrNodes === "string" ? [createPlainText(textOrNodes)] : [...textOrNodes];

  return {
    type: "paragraph",
    children,
    position: createSyntheticRange(),
  };
}

/**
 * Create a plain text inline node.
 *
 * @example
 * ```ts
 * const text = createPlainText("Hello");
 * ```
 */
export function createPlainText(value: string): TextNode {
  return {
    type: "text",
    value,
    position: createSyntheticRange(),
  };
}

/**
 * Create a list node with the supplied list kind and items.
 *
 * Ordered lists normalize default item markers to `1.` so builder-generated
 * output stays stable when serialized.
 *
 * @example
 * ```ts
 * const list = createList("unordered", [
 *   createListItem("Install"),
 *   createListItem("Build"),
 * ]);
 * ```
 */
export function createList(kind: "unordered" | "ordered", items: ReadonlyArray<ListItem>): List {
  const children = kind === "ordered"
    ? items.map((item) => (item.marker === "-" ? { ...item, marker: "1." } : item))
    : [...items];

  return {
    type: "list",
    kind,
    children,
    position: createSyntheticRange(),
  };
}

/**
 * Create a list item from plain text content.
 *
 * @example
 * ```ts
 * const item = createListItem("Ship it", { checkbox: "checked" });
 * ```
 */
export function createListItem(
  text: string,
  options: {
    readonly checkbox?: ListItemCheckboxState;
    readonly marker?: string;
  } = {},
): ListItem {
  return {
    type: "list-item",
    marker: options.marker ?? "-",
    checkbox: options.checkbox ?? null,
    children: [createPlainText(text)],
    position: createSyntheticRange(),
  };
}

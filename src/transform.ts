import type {
  Heading,
  Position,
  Root,
  TimestampNode,
} from "./ast.js";
import { pad2 } from "./internal/utils.js";
import { walk } from "./traverse.js";

/**
 * A transformer plugin that receives a cloned root AST and returns the next AST.
 *
 * @example
 * ```ts
 * const plugin: Plugin = (root) => root;
 * ```
 */
export type Plugin = (ast: Root) => Root;

/**
 * Backwards-compatible alias for `Plugin`.
 */
export type Transformer = Plugin;

/**
 * Apply a sequence of plugins to an org AST without mutating the input tree.
 *
 * The input AST is cloned with `structuredClone` so plugins can freely mutate
 * their private copy. Parser-recorded spacing/planning metadata lives in a
 * WeakMap side channel that is intentionally not carried across the clone, so
 * transformed trees normalize to default spacing.
 *
 * @example
 * ```ts
 * const next = applyPlugins(parse("* TODO Task"), [resolveTodos()]);
 * ```
 */
export function applyPlugins(ast: Root, plugins: ReadonlyArray<Plugin>): Root {
  let current = structuredClone(ast);

  for (const plugin of plugins) {
    current = plugin(current);
  }

  return current;
}

/**
 * Create a fresh timestamp node for plugin-generated planning metadata.
 */
export function createTimestampFromDate(date: Date, position: Position): TimestampNode {
  return {
    type: "timestamp",
    isActive: true,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    time: `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`,
    position: {
      start: position,
      end: {
        index: position.index,
        line: position.line,
        column: position.column,
      },
    },
  };
}

export function visitHeadings(root: Root, visitor: (heading: Heading) => void): void {
  walk(root, {
    heading(node) {
      visitor(node);
    },
  });
}

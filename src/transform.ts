import type {
  Heading,
  Position,
  Root,
  TimestampNode,
} from "./ast.js";
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
 * @example
 * ```ts
 * const next = applyPlugins(parse("* TODO Task"), [resolveTodos()]);
 * ```
 */
export function applyPlugins(ast: Root, plugins: ReadonlyArray<Plugin>): Root {
  let current = cloneValue(ast);

  for (const plugin of plugins) {
    current = plugin(current);
  }

  return current;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        continue;
      }

      if ("value" in descriptor) {
        descriptor.value = cloneValue(descriptor.value);
      }

      Object.defineProperty(clone, key, descriptor);
    }

    return clone as T;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  const clone = Object.create(prototype) as Record<PropertyKey, unknown>;

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      continue;
    }

    if ("value" in descriptor) {
      descriptor.value = cloneValue(descriptor.value);
    }

    Object.defineProperty(clone, key, descriptor);
  }

  return clone as T;
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

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

import type { Heading, Planning, Root } from "../ast.js";
import type { Plugin } from "../transform.js";
import { createTimestampFromDate } from "../transform.js";

/**
 * Convert all TODO headings to DONE and stamp them with CLOSED.
 *
 * The plugin builds fresh heading nodes rather than mutating in place, so the
 * readonly AST contract is respected without any type-bypassing cast.
 *
 * @example
 * ```ts
 * const next = resolveTodos(new Date("2026-05-08T12:34:00Z"))(parse("* TODO Task"));
 * ```
 */
export function resolveTodos(now: Date = new Date()): Plugin {
  return (root: Root): Root => {
    const children = root.children.map((child): Root["children"][number] => {
      if (child.type !== "heading" || child.todoKeyword !== "TODO") {
        return child;
      }

      const closed = createTimestampFromDate(now, child.position.end);
      const planning: Planning =
        child.planning === undefined
          ? { closed }
          : child.planning.closed !== undefined
            ? child.planning
            : { ...child.planning, closed };

      return {
        type: "heading",
        level: child.level,
        tags: child.tags,
        properties: child.properties,
        planning,
        children: child.children,
        position: child.position,
        todoKeyword: "DONE",
      } satisfies Heading;
    });

    return { ...root, children };
  };
}

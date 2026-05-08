import type { Heading, Root } from "../ast.js";
import type { Plugin } from "../transform.js";
import { createTimestampFromDate, visitHeadings } from "../transform.js";

type MutableHeading = {
  -readonly [K in keyof Heading]: Heading[K];
};

/**
 * Convert all TODO headings to DONE and stamp them with CLOSED.
 *
 * @example
 * ```ts
 * const next = resolveTodos(new Date("2026-05-08T12:34:00Z"))(parse("* TODO Task"));
 * ```
 */
export function resolveTodos(now: Date = new Date()): Plugin {
  return (root: Root): Root => {
    visitHeadings(root, (heading) => {
      if (heading.todoKeyword !== "TODO") {
        return;
      }

      const mutableHeading = heading as MutableHeading;
      mutableHeading.todoKeyword = "DONE";

      const closed = createTimestampFromDate(now, heading.position.end);
      if (mutableHeading.planning === undefined) {
        mutableHeading.planning = { closed };
        return;
      }

      if (mutableHeading.planning.closed !== undefined) {
        return;
      }

      mutableHeading.planning = {
        ...mutableHeading.planning,
        closed,
      };
    });

    return root;
  };
}

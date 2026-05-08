import type { Heading, Root } from "../ast.js";
import type { Plugin } from "../transform.js";
import { visitHeadings } from "../transform.js";

/**
 * Remove headings whose tag list contains any configured tag.
 *
 * @example
 * ```ts
 * const next = stripTags(["secret"])(parse("* TODO Hidden :secret:"));
 * ```
 */
export function stripTags(tags: ReadonlyArray<string>): Plugin {
  const tagSet = new Set(tags);

  return (root: Root): Root => {
    const removed = new Set<Heading>();

    visitHeadings(root, (heading) => {
      if (heading.tags.some((tag) => tagSet.has(tag))) {
        removed.add(heading);
      }
    });

    if (removed.size === 0) {
      return root;
    }

    return {
      ...root,
      children: root.children.filter((child) => {
        if (child.type !== "heading") {
          return true;
        }

        return !removed.has(child);
      }),
    };
  };
}
